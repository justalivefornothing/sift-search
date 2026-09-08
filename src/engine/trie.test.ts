import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { damerauLevenshtein } from './levenshtein.ts'
import { Trie } from './trie.ts'

const WORDS = ['matrix', 'matrimony', 'matter', 'material', 'mat', 'max', 'mad', 'star', 'start', 'stars', 'wars', 'war', 'warm', 'the', 'them', 'theatre']

function build(words: string[]): Trie {
  const trie = new Trie()
  for (const w of words) trie.insert(w)
  return trie
}

/** every prefix of `term` within `max` of `query`? returns the best distance or Infinity */
function bruteBestPrefix(query: string, term: string, max: number): number {
  let best = Number.POSITIVE_INFINITY
  for (let len = 0; len <= term.length; len++) {
    const d = damerauLevenshtein(query, term.slice(0, len), max)
    if (d < best) best = d
  }
  return best <= max ? best : Number.POSITIVE_INFINITY
}

describe('Trie', () => {
  it('assigns stable ids and compresses shared prefixes into radix nodes', () => {
    const trie = build(WORDS)
    expect(trie.size).toBe(WORDS.length)
    expect(trie.insert('matrix')).toBe(trie.get('matrix'))
    expect(trie.get('nope')).toBe(-1)
    expect(trie.has('mat')).toBe(true)
    // far fewer nodes than characters: shared "mat", "star", "the" segments are compressed
    expect(trie.nodeCount).toBeLessThan(WORDS.join('').length)
    for (const w of WORDS) expect(trie.termById(trie.get(w))).toBe(w)
  })

  it('enumerates every term under a prefix, and nothing else', () => {
    const trie = build(WORDS)
    const terms = (ids: number[]) => ids.map((id) => trie.termById(id)).sort()
    expect(terms(trie.prefix('mat'))).toEqual(['mat', 'material', 'matrimony', 'matrix', 'matter'])
    expect(terms(trie.prefix('matr'))).toEqual(['matrimony', 'matrix'])
    expect(terms(trie.prefix('star'))).toEqual(['star', 'stars', 'start'])
    expect(terms(trie.prefix('the'))).toEqual(['the', 'theatre', 'them'])
    expect(terms(trie.prefix('xyz'))).toEqual([])
    expect(terms(trie.prefix(''))).toEqual([...WORDS].sort())
  })

  it('bounded fuzzy search finds full-form terms within the budget', () => {
    const trie = build(WORDS)
    const found = (q: string, max: number) =>
      trie
        .fuzzy(q, max, false)
        .map((m) => `${m.term}:${m.distance}`)
        .sort()
    expect(found('matrx', 1)).toEqual(['matrix:1'])
    expect(found('matirx', 1)).toEqual(['matrix:1']) // transposition
    expect(found('wra', 1)).toEqual(['war:1'])
    expect(found('sta', 1)).toEqual(['star:1'])
    expect(found('zzz', 2)).toEqual([])
  })

  it('prefix-mode fuzzy search matches when any prefix of the term is within budget', () => {
    const trie = build(WORDS)
    const found = trie.fuzzy('matrx', 1, true).map((m) => `${m.term}:${m.distance}`).sort()
    // "matr" (drop x) is a prefix of both, so both are one typo away; "matter" needs 2
    expect(found).toEqual(['matrimony:1', 'matrix:1'])
    const exactPrefix = trie.fuzzy('mat', 0, true).map((m) => m.term).sort()
    expect(exactPrefix).toEqual(['mat', 'material', 'matrimony', 'matrix', 'matter'])
  })

  it('agrees with brute force over random vocabularies (exact and prefix mode)', () => {
    const word = fc.string({ unit: fc.constantFrom('a', 'b', 'c'), minLength: 1, maxLength: 7 })
    fc.assert(
      fc.property(fc.uniqueArray(word, { minLength: 1, maxLength: 25 }), word, fc.integer({ min: 0, max: 2 }), (vocab, q, max) => {
        const trie = build(vocab)
        const exact = new Map(trie.fuzzy(q, max, false).map((m) => [m.term, m.distance]))
        const prefix = new Map(trie.fuzzy(q, max, true).map((m) => [m.term, m.distance]))
        for (const term of vocab) {
          const d = damerauLevenshtein(q, term)
          if (d <= max) expect(exact.get(term)).toBe(d)
          else expect(exact.has(term)).toBe(false)
          const best = bruteBestPrefix(q, term, max)
          if (best !== Number.POSITIVE_INFINITY) expect(prefix.get(term)).toBe(best)
          else expect(prefix.has(term)).toBe(false)
        }
        expect(exact.size).toBe(vocab.filter((t) => damerauLevenshtein(q, t) <= max).length)
      }),
      { numRuns: 300 },
    )
  })
})
