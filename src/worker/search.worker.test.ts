import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkerResponse } from './protocol.ts'

describe('search worker request recovery', () => {
  const messages: WorkerResponse[] = []
  const scope = {
    onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
    postMessage: (message: WorkerResponse) => { messages.push(message) },
  }

  beforeEach(async () => {
    vi.resetModules()
    messages.length = 0
    scope.onmessage = null
    vi.stubGlobal('self', scope)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
      { id: 'matrix', title: 'The Matrix', description: 'A simulation.', genres: ['Action'], year: 1999, rating: 8, popularity: 100 },
    ]))))
    await import('./search.worker.ts')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function send(data: unknown) {
    scope.onmessage?.({ data } as MessageEvent<unknown>)
  }

  it('scopes early/invalid queries to their ids and recovers after initialization', async () => {
    send({ type: 'query', id: 1, params: { query: 'matrix' } })
    expect(messages).toContainEqual({ type: 'error', id: 1, message: 'query received before the index was ready' })
    send({ type: 'init', url: '/data/records.json' })
    await vi.waitFor(() => expect(messages.some((message) => message.type === 'ready')).toBe(true))
    send({ type: 'query', id: 2, params: { query: 'matrix', facets: 3 } })
    expect(messages).toContainEqual({ type: 'error', id: 2, message: 'Invalid query parameters' })
    send({ type: 'query', id: 3, params: { query: 'matrix', page: 1e308 } })
    const result = messages.find((message) => message.type === 'result' && message.id === 3)
    expect(result).toMatchObject({ type: 'result', id: 3, response: { nbHits: 1, page: 0 } })
    expect(messages.filter((message) => message.type === 'error' && message.id === undefined)).toEqual([])
  })

  it('reports an engine exception for one id without disabling subsequent queries', async () => {
    send({ type: 'init', url: '/data/records.json' })
    await vi.waitFor(() => expect(messages.some((message) => message.type === 'ready')).toBe(true))
    const { SearchIndex } = await import('../engine/search-index.ts')
    vi.spyOn(SearchIndex.prototype, 'search').mockImplementationOnce(() => { throw new Error('query execution failed') })
    send({ type: 'query', id: 1, params: { query: 'matrix' } })
    expect(messages).toContainEqual({ type: 'error', id: 1, message: 'query execution failed' })
    send({ type: 'query', id: 2, params: { query: 'matrix' } })
    expect(messages).toContainEqual(expect.objectContaining({ type: 'result', id: 2 }))
  })
})
