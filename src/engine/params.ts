import type { QueryParams } from './types.ts'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function optionalNumber(value: unknown, minimum: number): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= minimum)
}

/** Validate JSON/message input before it reaches the typed engine API. */
export function isQueryParams(value: unknown): value is QueryParams {
  if (!isObject(value) || typeof value.query !== 'string') return false
  return optionalNumber(value.page, 0)
    && optionalNumber(value.hitsPerPage, 1)
    && optionalNumber(value.snippetLength, 1)
    && (value.typoTolerance === undefined || typeof value.typoTolerance === 'boolean')
    && (value.facets === undefined || isStringArray(value.facets))
    && (value.facetFilters === undefined || (Array.isArray(value.facetFilters) && value.facetFilters.every(isStringArray)))
}

/** The playground may omit a query, but must still supply a well-formed object. */
export function parseQueryBody(body: string): QueryParams {
  const value: unknown = JSON.parse(body)
  if (!isObject(value)) throw new Error('Request body must be a JSON object')
  const params = { ...value, query: value.query === undefined ? '' : value.query }
  if (!isQueryParams(params)) {
    throw new Error('Invalid query parameters: use a string query, finite non-negative page, positive numeric limits, string arrays for facets, and arrays of string arrays for facetFilters')
  }
  return params
}

/** Avoid coercion and non-finite arithmetic even for direct JavaScript callers. */
export function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.floor(value)))
    : fallback
}
