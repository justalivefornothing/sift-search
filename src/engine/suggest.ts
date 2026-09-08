/**
 * "Did you mean" suggestions for zero-result queries.
 *
 * Every query word is replaced by its closest index terms (full-form
 * Damerau–Levenshtein over the trie, up to 2 edits, most frequent term first)
 * and the resulting alternative queries are verified against the index so we
 * only ever suggest something that actually has hits.
 */
import type { InvertedIndex } from './inverted-index.ts'

const ALTERNATIVES_PER_WORD = 4
const MAX_VERIFICATIONS = 24

export function alternativesFor(index: InvertedIndex, word: string, limit = ALTERNATIVES_PER_WORD): string[] {
  if (word.length === 0) return []
  const budget = word.length >= 4 ? 2 : 1
  const matches = index.trie.fuzzy(word, budget, false).filter((m) => m.term !== word)
  matches.sort((a, b) => a.distance - b.distance || index.docFreq(b.termId) - index.docFreq(a.termId) || a.term.localeCompare(b.term))
  return matches.slice(0, limit).map((m) => m.term)
}

export function suggestQueries(
  index: InvertedIndex,
  words: readonly string[],
  countHits: (query: string) => number,
  limit = 3,
): string[] {
  if (words.length === 0) return []
  const alternatives = words.map((w) => alternativesFor(index, w))
  const known = words.map((w) => index.termId(w) >= 0)

  // candidate queries: fix unknown words first (single replacement each), then
  // try replacing known words one at a time for combination failures
  const candidates: string[] = []
  const push = (q: string): void => {
    if (!candidates.includes(q) && candidates.length < MAX_VERIFICATIONS) candidates.push(q)
  }

  const unknown = words.map((_, i) => i).filter((i) => !known[i])
  if (unknown.length > 0) {
    // replace all unknown words with their best alternative, then vary one at a time
    const base = words.map((w, i) => (known[i] ? w : alternatives[i][0] ?? w))
    push(base.join(' '))
    for (const i of unknown) {
      for (const alt of alternatives[i]) {
        const q = base.slice()
        q[i] = alt
        push(q.join(' '))
      }
    }
    // dropping an unknown word entirely is often the right fix
    if (words.length > 1) for (const i of unknown) push(words.filter((_, j) => j !== i).join(' '))
  } else {
    for (let i = 0; i < words.length; i++) {
      for (const alt of alternatives[i]) {
        const q = words.slice()
        q[i] = alt
        push(q.join(' '))
      }
    }
    if (words.length > 1) for (let i = 0; i < words.length; i++) push(words.filter((_, j) => j !== i).join(' '))
  }

  // candidates are already ordered by edit distance then term frequency; keep
  // that order and only drop alternatives that would still return nothing
  const out: string[] = []
  for (const q of candidates) {
    if (q === words.join(' ')) continue
    if (countHits(q) > 0) out.push(q)
    if (out.length >= limit) break
  }
  return out
}
