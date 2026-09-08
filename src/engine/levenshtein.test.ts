import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { damerauLevenshtein } from './levenshtein.ts'

/** Straightforward O(n·m) reference (optimal string alignment) used to cross-check the bounded version. */
function reference(a: string, b: string): number {
  const d: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    d.push(new Array<number>(b.length + 1).fill(0))
    d[i][0] = i
  }
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

describe('damerauLevenshtein', () => {
  it('counts a transposition as one edit', () => {
    expect(damerauLevenshtein('ab', 'ba')).toBe(1)
    expect(damerauLevenshtein('matirx', 'matrix')).toBe(1)
  })

  it('matches the classic examples', () => {
    expect(damerauLevenshtein('kitten', 'sitting')).toBe(3)
    expect(damerauLevenshtein('matrx', 'matrix')).toBe(1)
    expect(damerauLevenshtein('', 'abc')).toBe(3)
    expect(damerauLevenshtein('abc', '')).toBe(3)
    expect(damerauLevenshtein('same', 'same')).toBe(0)
  })

  it('honours the cut-off by returning max + 1', () => {
    expect(damerauLevenshtein('kitten', 'sitting', 1)).toBe(2)
    expect(damerauLevenshtein('kitten', 'sitting', 2)).toBe(3)
    expect(damerauLevenshtein('kitten', 'sitting', 3)).toBe(3)
    expect(damerauLevenshtein('a', 'abcdef', 2)).toBe(3)
  })

  it('agrees with a reference implementation and is symmetric', () => {
    const word = fc.string({ unit: fc.constantFrom('a', 'b', 'c', 'd'), maxLength: 9 })
    fc.assert(
      fc.property(word, word, fc.integer({ min: 0, max: 4 }), (a, b, max) => {
        const exact = reference(a, b)
        expect(damerauLevenshtein(a, b)).toBe(exact)
        expect(damerauLevenshtein(b, a)).toBe(exact)
        const bounded = damerauLevenshtein(a, b, max)
        if (exact <= max) expect(bounded).toBe(exact)
        else expect(bounded).toBe(max + 1)
      }),
      { numRuns: 400 },
    )
  })
})
