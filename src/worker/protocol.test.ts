import { describe, expect, it } from 'vitest'
import { isWorkerRequest, isWorkerResponse } from './protocol.ts'

describe('worker protocol guards', () => {
  it('accepts well-formed requests and responses', () => {
    expect(isWorkerRequest({ type: 'init', url: '/data/records.json' })).toBe(true)
    expect(isWorkerRequest({ type: 'query', id: 1, params: { query: 'x' } })).toBe(true)
    expect(isWorkerResponse({ type: 'progress', phase: 'downloading', loadedBytes: 1, totalBytes: 2 })).toBe(true)
    expect(isWorkerResponse({ type: 'ready', stats: {}, downloadMs: 1, parseMs: 1 })).toBe(true)
    expect(isWorkerResponse({ type: 'result', id: 1, response: {} })).toBe(true)
    expect(isWorkerResponse({ type: 'error', message: 'boom' })).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isWorkerRequest(null)).toBe(false)
    expect(isWorkerRequest('init')).toBe(false)
    expect(isWorkerRequest({ type: 'ready' })).toBe(false)
    expect(isWorkerResponse({ type: 'query' })).toBe(false)
    expect(isWorkerResponse(42)).toBe(false)
  })
})
