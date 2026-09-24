import { describe, expect, it } from 'vitest'
import { isWorkerRequest, isWorkerResponse } from './protocol.ts'
import { SearchIndex } from '../engine/search-index.ts'

const index = new SearchIndex([])

describe('worker protocol guards', () => {
  it('accepts well-formed requests and responses', () => {
    expect(isWorkerRequest({ type: 'init', url: '/data/records.json' })).toBe(true)
    expect(isWorkerRequest({ type: 'query', id: 1, params: { query: 'x' } })).toBe(true)
    expect(isWorkerResponse({ type: 'progress', phase: 'downloading', loadedBytes: 1, totalBytes: 2 })).toBe(true)
    expect(isWorkerResponse({ type: 'ready', stats: index.stats, downloadMs: 1, parseMs: 1 })).toBe(true)
    expect(isWorkerResponse({ type: 'result', id: 1, response: index.search({ query: '' }) })).toBe(true)
    expect(isWorkerResponse({ type: 'error', message: 'boom' })).toBe(true)
    expect(isWorkerResponse({ type: 'error', id: 1, message: 'bad query' })).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isWorkerRequest(null)).toBe(false)
    expect(isWorkerRequest('init')).toBe(false)
    expect(isWorkerRequest({ type: 'ready' })).toBe(false)
    expect(isWorkerResponse({ type: 'query' })).toBe(false)
    expect(isWorkerResponse(42)).toBe(false)
  })

  it('rejects malformed request payloads, ids, and error/result envelopes', () => {
    for (const id of [undefined, 0, -1, 1.5, Infinity, '1']) {
      expect(isWorkerRequest({ type: 'query', id, params: { query: '' } })).toBe(false)
    }
    expect(isWorkerRequest({ type: 'query', id: 1, params: { query: 'matrix', facets: 3 } })).toBe(false)
    expect(isWorkerRequest({ type: 'init' })).toBe(false)
    expect(isWorkerRequest({ type: 'init', url: '' })).toBe(false)
    expect(isWorkerResponse({ type: 'error', id: '1', message: 'bad query' })).toBe(false)
    expect(isWorkerResponse({ type: 'error', id: 1 })).toBe(false)
    expect(isWorkerResponse({ type: 'result', id: 1, response: {} })).toBe(false)
    expect(isWorkerResponse({ type: 'ready', stats: {}, downloadMs: 1, parseMs: 1 })).toBe(false)
    expect(isWorkerResponse({ type: 'progress', phase: 'made-up', loadedBytes: 0, totalBytes: 1 })).toBe(false)
  })
})
