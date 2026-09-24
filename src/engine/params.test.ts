import { describe, expect, it } from 'vitest'
import { isQueryParams, parseQueryBody } from './params.ts'

describe('query input validation', () => {
  it('accepts the supported playground fields and defaults an omitted query', () => {
    expect(parseQueryBody('{}')).toEqual({ query: '' })
    const params = { query: 'matrix', page: 2, hitsPerPage: 10, snippetLength: 4, facets: ['genre'], facetFilters: [['genre:Action']], typoTolerance: false }
    expect(parseQueryBody(JSON.stringify(params))).toEqual(params)
    expect(isQueryParams({ query: 'matrix', page: 1e308 })).toBe(true)
  })

  it.each([
    'null', '[]', '"matrix"', '3', '{"query":null}', '{"query":3}',
    '{"query":"matrix","facets":3}', '{"facets":[3]}', '{"facetFilters":["genre:Action"]}',
    '{"facetFilters":[[3]]}', '{"page":"2"}', '{"page":-1}', '{"page":1e309}',
    '{"hitsPerPage":0}', '{"snippetLength":0}', '{"typoTolerance":"false"}',
  ])('rejects invalid JSON parameter shape %s', (body) => {
    expect(() => parseQueryBody(body)).toThrow()
  })

  it('rejects non-finite numeric fields sent by structured clone', () => {
    for (const key of ['page', 'hitsPerPage', 'snippetLength']) {
      for (const value of [NaN, Infinity, -Infinity]) {
        expect(isQueryParams({ query: '', [key]: value })).toBe(false)
      }
    }
  })
})
