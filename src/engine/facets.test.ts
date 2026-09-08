import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { Bitset } from './bitset.ts'
import { DEFAULT_FACETS, FacetIndex, decadeOf, parseFacetFilters, ratingBucket, type FacetFilters } from './facets.ts'
import type { SearchRecord } from './types.ts'

function rec(id: number, genres: string[], year: number, rating: number): SearchRecord {
  return { id: `r${id}`, title: `t${id}`, description: '', genres, year, rating, popularity: id }
}

const RECORDS: SearchRecord[] = [
  rec(0, ['Action', 'Sci-Fi'], 1999, 8.7),
  rec(1, ['Sci-Fi', 'Action'], 2003, 7.2),
  rec(2, ['Drama'], 1972, 9.2),
  rec(3, ['Drama', 'Crime'], 1994, 8.9),
  rec(4, ['Comedy'], 2001, 8.3),
  rec(5, ['Action'], 2015, 6.1),
]

/** naive reference: docs in `base` that satisfy OR within each facet and AND across facets */
function bruteFilter(records: SearchRecord[], base: number[], filters: FacetFilters): number[] {
  return base.filter((doc) =>
    Object.entries(filters).every(([facet, values]) => {
      if (values.length === 0) return true
      const def = DEFAULT_FACETS.find((d) => d.name === facet)!
      const have = def.values(records[doc])
      return values.some((v) => have.includes(v))
    }),
  )
}

describe('facets', () => {
  it('buckets decades and ratings', () => {
    expect(decadeOf(1999)).toBe('1990s')
    expect(decadeOf(2003)).toBe('2000s')
    expect(ratingBucket(9.2)).toBe('9+')
    expect(ratingBucket(8.0)).toBe('8–9')
    expect(ratingBucket(6.1)).toBe('6–7')
    expect(ratingBucket(3)).toBe('<6')
  })

  it('parses Algolia-style facetFilters (outer AND, inner OR)', () => {
    expect(parseFacetFilters([['genre:Action', 'genre:Drama'], ['decade:1990s']])).toEqual({ genre: ['Action', 'Drama'], decade: ['1990s'] })
    expect(parseFacetFilters(undefined)).toEqual({})
    expect(parseFacetFilters([['rating:8–9']])).toEqual({ rating: ['8–9'] })
  })

  it('counts values over the unfiltered result set', () => {
    const fi = new FacetIndex(RECORDS)
    const { filtered, counts } = fi.apply(Bitset.full(RECORDS.length), {})
    expect(filtered.count()).toBe(6)
    expect(counts.genre).toEqual({ Action: 3, 'Sci-Fi': 2, Drama: 2, Crime: 1, Comedy: 1 })
    expect(counts.decade).toEqual({ '1990s': 2, '2000s': 2, '1970s': 1, '2010s': 1 })
    expect(counts.rating).toEqual({ '8–9': 3, '7–8': 1, '9+': 1, '6–7': 1 })
  })

  it('multi-select within a facet is OR, across facets is AND; counts are disjunctive', () => {
    const fi = new FacetIndex(RECORDS)
    const { filtered, counts } = fi.apply(Bitset.full(RECORDS.length), { genre: ['Drama', 'Comedy'], decade: ['1990s', '2000s'] })
    expect(filtered.toArray()).toEqual([3, 4]) // Drama∪Comedy ∩ (1990s∪2000s)
    // genre counts ignore the genre selection but respect the decade selection
    expect(counts.genre).toEqual({ Action: 2, 'Sci-Fi': 2, Drama: 1, Crime: 1, Comedy: 1 })
    // decade counts ignore the decade selection but respect the genre selection
    expect(counts.decade).toEqual({ '1970s': 1, '1990s': 1, '2000s': 1 })
    // rating counts respect both selections
    expect(counts.rating).toEqual({ '8–9': 2 })
  })

  it('keeps a selected value visible with a zero count', () => {
    const fi = new FacetIndex(RECORDS)
    const base = Bitset.fromIndices(RECORDS.length, [2]) // only the 1972 drama
    const { counts } = fi.apply(base, { genre: ['Comedy'] })
    expect(counts.genre.Comedy).toBe(0)
    expect(counts.genre.Drama).toBe(1)
  })

  it('matches a brute-force filter on random selections', () => {
    const genres = ['Action', 'Sci-Fi', 'Drama', 'Crime', 'Comedy']
    const decades = ['1970s', '1990s', '2000s', '2010s']
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: RECORDS.length - 1 })),
        fc.subarray(genres),
        fc.subarray(decades),
        (baseDocs, g, d) => {
          const fi = new FacetIndex(RECORDS)
          const filters: FacetFilters = { genre: g, decade: d }
          const { filtered, counts } = fi.apply(Bitset.fromIndices(RECORDS.length, baseDocs), filters)
          expect(filtered.toArray()).toEqual(bruteFilter(RECORDS, [...baseDocs].sort((a, b) => a - b), filters))
          // each genre count = docs you would get by adding that value (OR) given the other facets
          for (const [value, n] of Object.entries(counts.genre)) {
            const would = bruteFilter(RECORDS, baseDocs, { genre: [value], decade: d })
            expect(n).toBe(would.length)
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
