import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { compareCriteria, findTieBreak, packScore } from './ranker.ts'
import { CRITERIA, type Criteria } from './types.ts'

const base: Criteria = { typos: 0, words: 2, proximity: 1, attribute: 0, exactness: 2, popularity: 100 }

describe('tiered ranking comparator', () => {
  it('orders by typos, then words, proximity, attribute, exactness, popularity', () => {
    const better = (a: Partial<Criteria>, b: Partial<Criteria>) => compareCriteria({ ...base, ...a }, { ...base, ...b })
    expect(better({ typos: 0 }, { typos: 1 })).toBeLessThan(0)
    expect(better({ words: 2 }, { words: 1 })).toBeLessThan(0)
    expect(better({ proximity: 1 }, { proximity: 5 })).toBeLessThan(0)
    expect(better({ attribute: 0 }, { attribute: 2 })).toBeLessThan(0)
    expect(better({ exactness: 2 }, { exactness: 1 })).toBeLessThan(0)
    expect(better({ popularity: 900 }, { popularity: 100 })).toBeLessThan(0)
    expect(better({}, {})).toBe(0)
  })

  it('an earlier criterion always beats any combination of later ones', () => {
    // one more typo loses even with more words, better proximity, attribute, exactness and popularity
    const a: Criteria = { typos: 1, words: 5, proximity: 0, attribute: 0, exactness: 5, popularity: 1e6 }
    const b: Criteria = { typos: 0, words: 1, proximity: 50, attribute: 2, exactness: 0, popularity: 0 }
    expect(compareCriteria(b, a)).toBeLessThan(0)
    // fewer matched words loses even with better proximity/attribute/exactness/popularity
    const c: Criteria = { typos: 0, words: 1, proximity: 0, attribute: 0, exactness: 1, popularity: 1e6 }
    const d: Criteria = { typos: 0, words: 2, proximity: 16, attribute: 2, exactness: 0, popularity: 0 }
    expect(compareCriteria(d, c)).toBeLessThan(0)
  })

  it('packed score orders exactly like the comparator', () => {
    const criteria = fc.record({
      typos: fc.integer({ min: 0, max: 32 }),
      words: fc.integer({ min: 0, max: 16 }),
      proximity: fc.integer({ min: 0, max: 120 }),
      attribute: fc.integer({ min: 0, max: 2 }),
      exactness: fc.integer({ min: 0, max: 16 }),
      popularity: fc.integer({ min: 0, max: 200000 }),
    })
    fc.assert(
      fc.property(criteria, criteria, (a, b) => {
        // popScore is a rank derived from popularity; use popularity directly scaled into range
        const pa = Math.min(a.popularity, 2097151)
        const pb = Math.min(b.popularity, 2097151)
        const cmp = compareCriteria(a, b)
        const sa = packScore(a, pa)
        const sb = packScore(b, pb)
        if (cmp < 0) expect(sa).toBeGreaterThan(sb)
        else if (cmp > 0) expect(sa).toBeLessThan(sb)
        else expect(sa).toBe(sb)
        expect(Number.isSafeInteger(sa)).toBe(true)
      }),
      { numRuns: 500 },
    )
  })

  it('finds the first criterion that broke the tie', () => {
    expect(findTieBreak(base, { ...base, popularity: 50 })).toEqual({ criterion: 'popularity', previous: 100, current: 50 })
    expect(findTieBreak(base, { ...base, proximity: 4, popularity: 5000 })).toEqual({ criterion: 'proximity', previous: 1, current: 4 })
    expect(findTieBreak(base, { ...base, typos: 1, words: 0 })).toEqual({ criterion: 'typos', previous: 0, current: 1 })
    expect(findTieBreak(base, { ...base })).toBeNull()
    expect(CRITERIA).toEqual(['typos', 'words', 'proximity', 'attribute', 'exactness', 'popularity'])
  })
})
