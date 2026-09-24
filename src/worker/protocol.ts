/**
 * Hand-rolled postMessage protocol between the UI thread and the search worker.
 * Plain discriminated unions — no Comlink, no proxies — so the wire format is
 * obvious and testable.
 */
import type { IndexStats, QueryParams, QueryResponse } from '../engine/types.ts'
import { isQueryParams } from '../engine/params.ts'

export type WorkerRequest =
  | { type: 'init'; url: string }
  | { type: 'query'; id: number; params: QueryParams }

export type LoadPhase = 'downloading' | 'parsing' | 'indexing'

export type WorkerResponse =
  | { type: 'progress'; phase: LoadPhase; loadedBytes: number; totalBytes: number }
  | { type: 'ready'; stats: IndexStats; downloadMs: number; parseMs: number }
  | { type: 'result'; id: number; response: QueryResponse }
  /** No id means worker initialization/crash; an id scopes the error to one query. */
  | { type: 'error'; message: string; id?: number }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasNumbers(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => isNumber(value[key]))
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function requestId(value: unknown): number | undefined {
  return isObject(value) && typeof value.id === 'number' && Number.isSafeInteger(value.id) && value.id > 0 ? value.id : undefined
}

function isHighlight(value: unknown, withWords: boolean): boolean {
  return isObject(value) && typeof value.value === 'string'
    && ['none', 'partial', 'full'].includes(String(value.matchLevel))
    && (!withWords || isStringArray(value.matchedWords))
}

function isHit(value: unknown): boolean {
  if (!isObject(value) || !isObject(value._highlightResult) || !isObject(value._snippetResult) || !isObject(value._rankingInfo)) return false
  const highlight = value._highlightResult
  const ranking = value._rankingInfo
  const tie = ranking.tieBreak
  const criteria = ['typos', 'words', 'proximity', 'attribute', 'exactness', 'popularity']
  return ['id', 'objectID', 'title', 'description'].every((key) => typeof value[key] === 'string')
    && hasNumbers(value, ['year', 'rating', 'popularity']) && isStringArray(value.genres)
    && isHighlight(highlight.title, true) && isHighlight(highlight.description, true)
    && Array.isArray(highlight.genres) && highlight.genres.every((item) => isHighlight(item, true))
    && isHighlight(value._snippetResult.description, false)
    && hasNumbers(ranking, criteria) && ['title', 'genres', 'description', 'none'].includes(String(ranking.attributeName))
    && (tie === null || (isObject(tie) && criteria.includes(String(tie.criterion)) && hasNumbers(tie, ['previous', 'current'])))
    && Array.isArray(ranking.matchedTerms) && ranking.matchedTerms.every((term) => isObject(term)
      && typeof term.word === 'string' && typeof term.term === 'string' && isNumber(term.typos) && typeof term.exact === 'boolean')
}

function isQueryResponse(value: unknown): value is QueryResponse {
  return isObject(value) && Array.isArray(value.hits) && value.hits.every(isHit)
    && hasNumbers(value, ['nbHits', 'page', 'nbPages', 'hitsPerPage', 'processingTimeMS'])
    && ['query', 'params', 'index'].every((key) => typeof value[key] === 'string')
    && value.exhaustiveNbHits === true && isStringArray(value.suggestions)
    && isObject(value.facets) && Object.values(value.facets).every((counts) => isObject(counts) && Object.values(counts).every(isNumber))
    && Array.isArray(value.parsedQuery) && value.parsedQuery.every((word) => isObject(word)
      && typeof word.word === 'string' && typeof word.prefix === 'boolean' && hasNumbers(word, ['maxTypos', 'candidates']))
}

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (!isObject(value)) return false
  switch (value.type) {
    case 'progress':
      return ['downloading', 'parsing', 'indexing'].includes(String(value.phase)) && hasNumbers(value, ['loadedBytes', 'totalBytes'])
    case 'ready':
      return hasNumbers(value, ['downloadMs', 'parseMs']) && isObject(value.stats)
        && hasNumbers(value.stats, ['records', 'terms', 'postings', 'positions', 'trieNodes', 'indexTimeMs', 'approxBytes'])
    case 'result':
      return requestId(value) !== undefined && isQueryResponse(value.response)
    case 'error':
      return typeof value.message === 'string' && (value.id === undefined || requestId(value) !== undefined)
    default:
      return false
  }
}

export function isWorkerRequest(value: unknown): value is WorkerRequest {
  if (!isObject(value)) return false
  return (value.type === 'init' && typeof value.url === 'string' && value.url.length > 0)
    || (value.type === 'query' && requestId(value) !== undefined && isQueryParams(value.params))
}
