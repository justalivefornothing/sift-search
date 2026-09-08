/**
 * Query planning: turn the raw query string into a list of words, decide the
 * typo budget of each word, and expand every word into the index terms it may
 * match (exact, prefix and typo candidates) together with the cost of that
 * match. The scorer then treats each candidate as "query word i matched via
 * term t with k typos".
 */
import { damerauLevenshtein } from './levenshtein.ts'
import type { InvertedIndex } from './inverted-index.ts'
import { tokenizeToStrings } from './tokenizer.ts'
import type { ParsedQueryWord } from './types.ts'

export interface Candidate {
  termId: number
  term: string
  /** typos needed to reach this term (0 for exact / plain prefix matches) */
  typos: number
  /** true when the whole term matches the word (possibly with typos), false when only a prefix does */
  exact: boolean
}

export interface PlannedWord {
  word: string
  maxTypos: number
  prefix: boolean
  candidates: Candidate[]
}

export interface QueryPlan {
  words: PlannedWord[]
}

/** Hard cap on words per query; extra words are ignored. Keeps bit masks in 32 bits. */
export const MAX_QUERY_WORDS = 16
/** Cap on typo candidates per word (highest document frequency wins). */
export const MAX_TYPO_CANDIDATES = 64
/** Cap on zero-typo prefix candidates per word (very short prefixes explode otherwise). */
export const MAX_PREFIX_CANDIDATES = 4096

export interface PlanOptions {
  typoTolerance: boolean
  /** treat the last word as a prefix (search-as-you-type) unless the query ends in whitespace */
  prefixLast: boolean
}

/** 1 typo for words of 4+ characters, 2 typos for 8+ characters, none below. */
export function typoBudget(word: string, enabled = true): number {
  if (!enabled) return 0
  if (word.length >= 8) return 2
  if (word.length >= 4) return 1
  return 0
}

export function planQuery(index: InvertedIndex, query: string, options: PlanOptions): QueryPlan {
  const words = tokenizeToStrings(query).slice(0, MAX_QUERY_WORDS)
  const endsOpen = !/\s$/.test(query)
  const planned: PlannedWord[] = []

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const prefix = options.prefixLast && endsOpen && i === words.length - 1
    const maxTypos = typoBudget(word, options.typoTolerance)
    planned.push({ word, maxTypos, prefix, candidates: expandWord(index, word, maxTypos, prefix) })
  }
  return { words: planned }
}

export function expandWord(index: InvertedIndex, word: string, maxTypos: number, prefix: boolean): Candidate[] {
  const matches = index.trie.fuzzy(word, maxTypos, prefix)
  const out: Candidate[] = []
  for (const m of matches) {
    let exact: boolean
    if (!prefix) exact = true
    else if (maxTypos === 0) exact = m.term === word
    else exact = damerauLevenshtein(word, m.term, maxTypos) <= maxTypos
    out.push({ termId: m.termId, term: m.term, typos: m.distance, exact })
  }
  // exact first, then fewer typos, then more frequent terms
  out.sort((a, b) => {
    if (a.typos !== b.typos) return a.typos - b.typos
    if (a.exact !== b.exact) return a.exact ? -1 : 1
    return index.docFreq(b.termId) - index.docFreq(a.termId)
  })
  // apply caps per tier
  let zero = 0
  let typo = 0
  const kept: Candidate[] = []
  for (const c of out) {
    if (c.typos === 0) {
      if (zero++ < MAX_PREFIX_CANDIDATES) kept.push(c)
    } else if (typo++ < MAX_TYPO_CANDIDATES) {
      kept.push(c)
    }
  }
  return kept
}

export function describePlan(plan: QueryPlan): ParsedQueryWord[] {
  return plan.words.map((w) => ({ word: w.word, maxTypos: w.maxTypos, prefix: w.prefix, candidates: w.candidates.length }))
}
