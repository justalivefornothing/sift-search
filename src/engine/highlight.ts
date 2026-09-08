/**
 * Highlighting and snippeting.
 *
 * Both work on token offsets into the ORIGINAL text, so "Amélie" is wrapped as
 * <mark>Amélie</mark> even though the index term is "amelie". Text outside the
 * marks is HTML-escaped; consumers may render the result as HTML.
 */
import { tokenize, type Token } from './tokenizer.ts'
import type { HighlightResult, SnippetResult } from './types.ts'

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c])
}

export interface MarkRange {
  start: number
  end: number
  /** index of the query word this token satisfied */
  word: number
}

/** Tokens of `text` that equal one of the matched terms, with the word they satisfied. */
export function findMarks(tokens: Token[], termsByWord: ReadonlySet<string>[]): MarkRange[] {
  const marks: MarkRange[] = []
  for (const tok of tokens) {
    for (let w = 0; w < termsByWord.length; w++) {
      if (termsByWord[w].has(tok.text)) {
        marks.push({ start: tok.start, end: tok.end, word: w })
        break
      }
    }
  }
  return marks
}

/** Wrap [start,end) ranges of `text` in <mark>, escaping everything. Ranges must be sorted and disjoint. */
export function wrapMarks(text: string, ranges: readonly MarkRange[], from = 0, to = text.length): string {
  let out = ''
  let cursor = from
  for (const r of ranges) {
    if (r.end <= from || r.start >= to) continue
    const s = Math.max(r.start, from)
    const e = Math.min(r.end, to)
    out += escapeHtml(text.slice(cursor, s))
    out += '<mark>' + escapeHtml(text.slice(s, e)) + '</mark>'
    cursor = e
  }
  out += escapeHtml(text.slice(cursor, to))
  return out
}

function matchLevel(marks: readonly MarkRange[], wordCount: number): HighlightResult['matchLevel'] {
  if (marks.length === 0 || wordCount === 0) return 'none'
  const words = new Set<number>()
  for (const m of marks) words.add(m.word)
  return words.size >= wordCount ? 'full' : 'partial'
}

export function highlight(text: string, termsByWord: ReadonlySet<string>[], queryWords: readonly string[]): HighlightResult {
  const tokens = tokenize(text)
  const marks = findMarks(tokens, termsByWord)
  const matched = new Set<string>()
  for (const m of marks) matched.add(queryWords[m.word])
  return { value: wrapMarks(text, marks), matchLevel: matchLevel(marks, queryWords.length), matchedWords: [...matched] }
}

/**
 * Snippet of at most `maxWords` tokens, positioned over the densest cluster of
 * matches (the window with the most marked tokens; earliest wins ties). With no
 * matches the snippet is simply the leading window.
 */
export function snippet(
  text: string,
  termsByWord: ReadonlySet<string>[],
  queryWords: readonly string[],
  maxWords = 24,
): SnippetResult {
  const tokens = tokenize(text)
  if (tokens.length === 0) return { value: escapeHtml(text), matchLevel: 'none' }
  const marks = findMarks(tokens, termsByWord)
  const marked = new Uint8Array(tokens.length)
  let mi = 0
  for (let i = 0; i < tokens.length && mi < marks.length; i++) {
    if (tokens[i].start === marks[mi].start) {
      marked[i] = 1
      mi++
    }
  }

  // sliding window: score = marked tokens inside; among equal scores prefer the
  // window that leaves ~LEAD tokens of context before the first match
  const LEAD = 3
  const window = Math.min(maxWords, tokens.length)
  const windows = tokens.length - window + 1
  let bestStart = 0
  let bestScore = -1
  let bestLeadPenalty = Number.POSITIVE_INFINITY
  let running = 0
  for (let i = 0; i < window; i++) running += marked[i]
  for (let start = 0; start < windows; start++) {
    if (start > 0) running += marked[start + window - 1] - marked[start - 1]
    if (running >= bestScore) {
      let first = start
      while (first < start + window && !marked[first]) first++
      const penalty = running === 0 ? start : Math.abs(first - start - LEAD)
      if (running > bestScore || penalty < bestLeadPenalty) {
        bestScore = running
        bestStart = start
        bestLeadPenalty = penalty
      }
    }
  }
  const endTok = Math.min(tokens.length, bestStart + window)
  const from = tokens[bestStart].start
  let to = endTok < tokens.length ? tokens[endTok].start : text.length
  while (to > from && /\s/.test(text[to - 1])) to--

  const body = wrapMarks(text, marks, from, to)
  const value = (bestStart > 0 ? '…' : '') + body + (endTok < tokens.length ? '…' : '')
  return { value, matchLevel: matchLevel(marks, queryWords.length) }
}
