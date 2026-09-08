import { describe, expect, it } from 'vitest'
import {
  countRefinements,
  emptyRefinements,
  parseSearchParams,
  serializeSearchParams,
  toFacetFilters,
  toQueryParams,
  toggleRefinement,
} from './url.ts'

describe('URL sync', () => {
  it('parses q and repeated facet params', () => {
    const state = parseSearchParams('?q=the%20matrix&genre=Sci-Fi&genre=Action&decade=1990s&rating=8%E2%80%939&page=2')
    expect(state.query).toBe('the matrix')
    expect(state.refinements.genre).toEqual(['Sci-Fi', 'Action'])
    expect(state.refinements.decade).toEqual(['1990s'])
    expect(state.refinements.rating).toEqual(['8–9'])
    expect(state.page).toBe(2)
    expect(state.explain).toBeNull()
  })

  it('parses the explain deep link', () => {
    expect(parseSearchParams('?q=x&explain=3').explain).toBe(3)
    expect(parseSearchParams('?q=x&explain=0').explain).toBeNull()
    expect(parseSearchParams('?q=x&explain=abc').explain).toBeNull()
  })

  it('accepts comma-separated values and de-duplicates', () => {
    const state = parseSearchParams('genre=Drama,Comedy&genre=Drama')
    expect(state.refinements.genre).toEqual(['Drama', 'Comedy'])
  })

  it('ignores garbage pages and unknown params', () => {
    const state = parseSearchParams('?page=-3&foo=bar')
    expect(state.page).toBe(0)
    expect(state.query).toBe('')
    expect(countRefinements(state.refinements)).toBe(0)
  })

  it('round-trips through serialize → parse', () => {
    const state = {
      query: 'amélie in kyoto',
      refinements: { genre: ['Romance', 'Drama'], decade: [], rating: ['9+'] },
      page: 1,
    }
    const qs = serializeSearchParams(state)
    expect(qs.startsWith('?q=')).toBe(true)
    expect(parseSearchParams(qs)).toEqual({ ...state, explain: null })
  })

  it('serialises the empty state to an empty string', () => {
    expect(serializeSearchParams({ query: '', refinements: emptyRefinements(), page: 0 })).toBe('')
  })

  it('maps refinements to Algolia-style facetFilters (AND of ORs)', () => {
    const refinements = { genre: ['Action', 'Drama'], decade: ['1990s'], rating: [] }
    expect(toFacetFilters(refinements)).toEqual([['genre:Action', 'genre:Drama'], ['decade:1990s']])
    const params = toQueryParams({ query: 'x', refinements, page: 0 }, 10)
    expect(params.facetFilters).toEqual([['genre:Action', 'genre:Drama'], ['decade:1990s']])
    expect(params.facets).toEqual(['genre', 'decade', 'rating'])
    expect(params.hitsPerPage).toBe(10)
    expect(toQueryParams({ query: '', refinements: emptyRefinements(), page: 0 }).facetFilters).toBeUndefined()
  })

  it('toggles a refinement on and off without mutating the input', () => {
    const base = emptyRefinements()
    const on = toggleRefinement(base, 'genre', 'Horror')
    expect(on.genre).toEqual(['Horror'])
    expect(base.genre).toEqual([])
    const off = toggleRefinement(on, 'genre', 'Horror')
    expect(off.genre).toEqual([])
  })
})
