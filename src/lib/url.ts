/**
 * URL <-> search state. Pure functions over URLSearchParams so the mapping is
 * unit-testable without a DOM:
 *
 *   ?q=matrix&genre=Sci-Fi&genre=Action&decade=1990s&rating=8%E2%80%939
 */
import type { QueryParams } from '../engine/types.ts'

export const FACET_NAMES = ['genre', 'decade', 'rating'] as const
export type FacetName = (typeof FACET_NAMES)[number]

export type Refinements = Record<FacetName, string[]>

export interface SearchState {
  query: string
  refinements: Refinements
  page: number
}

export function emptyRefinements(): Refinements {
  return { genre: [], decade: [], rating: [] }
}

export function parseSearchParams(search: string | URLSearchParams): SearchState {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const refinements = emptyRefinements()
  for (const name of FACET_NAMES) {
    const values = params.getAll(name).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)
    refinements[name] = [...new Set(values)]
  }
  const page = Number(params.get('page') ?? 0)
  return {
    query: params.get('q') ?? '',
    refinements,
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 0,
  }
}

export function serializeSearchParams(state: SearchState): string {
  const params = new URLSearchParams()
  if (state.query) params.set('q', state.query)
  for (const name of FACET_NAMES) {
    for (const value of state.refinements[name]) params.append(name, value)
  }
  if (state.page > 0) params.set('page', String(state.page))
  const s = params.toString()
  return s ? `?${s}` : ''
}

/** Algolia-style facetFilters: outer array AND, inner array OR. */
export function toFacetFilters(refinements: Refinements): string[][] {
  const out: string[][] = []
  for (const name of FACET_NAMES) {
    const values = refinements[name]
    if (values.length > 0) out.push(values.map((v) => `${name}:${v}`))
  }
  return out
}

export function toQueryParams(state: SearchState, hitsPerPage = 20): QueryParams {
  const facetFilters = toFacetFilters(state.refinements)
  const params: QueryParams = {
    query: state.query,
    hitsPerPage,
    page: state.page,
    facets: [...FACET_NAMES],
  }
  if (facetFilters.length > 0) params.facetFilters = facetFilters
  return params
}

export function toggleRefinement(refinements: Refinements, facet: FacetName, value: string): Refinements {
  const current = refinements[facet]
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  return { ...refinements, [facet]: next }
}

export function countRefinements(refinements: Refinements): number {
  return FACET_NAMES.reduce((n, name) => n + refinements[name].length, 0)
}
