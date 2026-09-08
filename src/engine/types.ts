/**
 * Shared engine types. This module (and everything under src/engine) is
 * dependency-free and DOM-free so it can run in Node, in a Web Worker and in
 * tests unchanged.
 */

/** A single searchable document. */
export interface SearchRecord {
  id: string
  title: string
  description: string
  genres: string[]
  year: number
  rating: number
  popularity: number
}

/** Searchable attributes in ranking order (index 0 ranks highest). */
export const ATTRIBUTES = ['title', 'genres', 'description'] as const
export type Attribute = (typeof ATTRIBUTES)[number]

/** The six ranking criteria, in tie-break order. */
export const CRITERIA = ['typos', 'words', 'proximity', 'attribute', 'exactness', 'popularity'] as const
export type Criterion = (typeof CRITERIA)[number]

/** Ranking-criterion vector for one hit. */
export interface Criteria {
  /** total typos across matched query words (lower is better) */
  typos: number
  /** number of distinct query words matched (higher is better) */
  words: number
  /** summed, capped word distance between consecutive query words (lower is better) */
  proximity: number
  /** best attribute rank hit (0 = title, 1 = genres, 2 = description; lower is better) */
  attribute: number
  /** number of query words matched exactly rather than by prefix (higher is better) */
  exactness: number
  /** custom ranking: record popularity (higher is better) */
  popularity: number
}

export interface TieBreak {
  criterion: Criterion
  /** value of the criterion on the previous (better ranked) hit */
  previous: number
  /** value on this hit */
  current: number
}

export interface RankingInfo extends Criteria {
  attributeName: Attribute | 'none'
  /** which criterion separated this hit from the hit ranked directly above it (null for the first hit or exact ties) */
  tieBreak: TieBreak | null
  /** matched query words with the index term they matched and typo count */
  matchedTerms: MatchedTerm[]
}

export interface MatchedTerm {
  word: string
  term: string
  typos: number
  exact: boolean
}

export interface HighlightResult {
  /** escaped text with matches wrapped in <mark> … </mark> */
  value: string
  matchLevel: 'none' | 'partial' | 'full'
  matchedWords: string[]
}

export interface SnippetResult {
  value: string
  matchLevel: 'none' | 'partial' | 'full'
}

export interface Hit extends SearchRecord {
  objectID: string
  _highlightResult: {
    title: HighlightResult
    description: HighlightResult
    genres: HighlightResult[]
  }
  _snippetResult: {
    description: SnippetResult
  }
  _rankingInfo: RankingInfo
}

export type FacetCounts = Record<string, Record<string, number>>

export interface QueryParams {
  query: string
  page?: number
  hitsPerPage?: number
  /** Algolia-style: outer array = AND, inner array = OR, values "facet:value" */
  facetFilters?: string[][]
  facets?: string[]
  typoTolerance?: boolean
  snippetLength?: number
}

export interface ParsedQueryWord {
  word: string
  maxTypos: number
  prefix: boolean
  candidates: number
}

export interface QueryResponse {
  hits: Hit[]
  nbHits: number
  page: number
  nbPages: number
  hitsPerPage: number
  /** engine time in milliseconds (fractional) */
  processingTimeMS: number
  query: string
  params: string
  index: string
  exhaustiveNbHits: true
  facets: FacetCounts
  parsedQuery: ParsedQueryWord[]
  /** 'did you mean' alternatives (only populated for zero-result queries) */
  suggestions: string[]
}

export interface IndexStats {
  records: number
  terms: number
  postings: number
  positions: number
  trieNodes: number
  indexTimeMs: number
  /** rough estimate of the typed-array footprint in bytes */
  approxBytes: number
}
