// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchIndex } from './engine/search-index.ts'
import type { WorkerRequest } from './worker/protocol.ts'

class FakeWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  onmessageerror: (() => void) | null = null
  messages: WorkerRequest[] = []
  postMessage(message: WorkerRequest) { this.messages.push(message) }
  terminate() {}
  emit(data: unknown) { this.onmessage?.({ data } as MessageEvent<unknown>) }
}

const index = new SearchIndex([
  { id: 'matrix', title: 'The Matrix', description: 'A simulation.', genres: ['Action'], year: 1999, rating: 8, popularity: 100 },
])

describe('store request recovery', () => {
  let worker: FakeWorker
  let useStore: typeof import('./store.ts').useStore
  let removePopstate: (() => void) | undefined

  beforeEach(async () => {
    vi.resetModules()
    worker = new FakeWorker()
    window.history.replaceState(null, '', '/')
    const addListener = window.addEventListener.bind(window)
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      addListener(type, listener, options)
      if (type === 'popstate') removePopstate = () => window.removeEventListener(type, listener, options)
    })
    vi.doMock('./worker/client.ts', async (importOriginal) => ({
      ...await importOriginal<typeof import('./worker/client.ts')>(),
      createSearchWorker: () => worker as unknown as Worker,
    }))
    useStore = (await import('./store.ts')).useStore
    useStore.getState().boot()
    worker.emit({ type: 'ready', stats: index.stats, downloadMs: 0, parseMs: 0 })
    respondToLatest()
    await vi.waitFor(() => expect(useStore.getState().response?.nbHits).toBe(1))
  })

  afterEach(() => {
    removePopstate?.()
    removePopstate = undefined
    vi.restoreAllMocks()
    vi.doUnmock('./worker/client.ts')
  })

  function latestRequest() {
    const request = worker.messages.filter((message) => message.type === 'query').at(-1)
    if (!request) throw new Error('Expected a query request')
    return request
  }

  function respondToLatest() {
    const request = latestRequest()
    worker.emit({ type: 'result', id: request.id, response: index.search(request.params) })
  }

  it('keeps search ready after invalid playground JSON and permits a corrected request', async () => {
    const before = worker.messages.length
    useStore.getState().setPlaygroundBody('{"query":"matrix","facets":3}')
    await useStore.getState().runPlayground()
    expect(useStore.getState().playground.error).toContain('Invalid query parameters')
    expect(worker.messages).toHaveLength(before)
    expect(useStore.getState().status).toBe('ready')
    useStore.getState().setPlaygroundBody('{"query":"matrix","facets":["genre"]}')
    const run = useStore.getState().runPlayground()
    respondToLatest()
    await run
    expect(useStore.getState().playground.error).toBeNull()
    expect(useStore.getState().playground.response?.hits[0].title).toBe('The Matrix')
    useStore.getState().setQuery('matrx')
    respondToLatest()
    await vi.waitFor(() => expect(useStore.getState().response?.query).toBe('matrx'))
  })

  it('contains a worker query error to the playground and recovers on retry', async () => {
    useStore.getState().setPlaygroundBody('{"query":"matrix"}')
    const run = useStore.getState().runPlayground()
    worker.emit({ type: 'error', id: latestRequest().id, message: 'request failed' })
    await run
    expect(useStore.getState().status).toBe('ready')
    expect(useStore.getState().playground.error).toBe('request failed')
    expect(useStore.getState().errorMessage).toBeNull()
    useStore.getState().setPlaygroundBody('{"query":"matrx"}')
    const retry = useStore.getState().runPlayground()
    respondToLatest()
    await retry
    expect(useStore.getState().playground.error).toBeNull()
    expect(useStore.getState().playground.response?.query).toBe('matrx')
  })

  it('recovers ordinary search after a request-specific worker error', async () => {
    useStore.getState().setQuery('bad')
    worker.emit({ type: 'error', id: latestRequest().id, message: 'query failed' })
    await vi.waitFor(() => expect(useStore.getState().errorMessage).toBe('query failed'))
    expect(useStore.getState().status).toBe('ready')
    useStore.getState().setQuery('matrix')
    respondToLatest()
    await vi.waitFor(() => expect(useStore.getState().response?.query).toBe('matrix'))
    expect(useStore.getState().errorMessage).toBeNull()
  })

  it('synchronizes a clamped page back to state and the URL', async () => {
    useStore.getState().setPage(1e308)
    respondToLatest()
    await vi.waitFor(() => expect(useStore.getState().page).toBe(0))
    expect(window.location.search).toBe('')
    expect(useStore.getState().response?.hits).toHaveLength(1)
  })

  it('does not replace newer search results with an older request error', async () => {
    useStore.getState().setQuery('old')
    const oldId = latestRequest().id
    useStore.getState().setQuery('matrix')
    respondToLatest()
    worker.emit({ type: 'error', id: oldId, message: 'outdated failure' })
    await vi.waitFor(() => expect(useStore.getState().response?.query).toBe('matrix'))
    expect(useStore.getState().errorMessage).toBeNull()
  })

  it('does not overwrite a synced playground body with an older response', async () => {
    useStore.getState().setPlaygroundBody('{"query":"old"}')
    const run = useStore.getState().runPlayground()
    const request = latestRequest()
    useStore.getState().syncPlaygroundBody()
    worker.emit({ type: 'result', id: request.id, response: index.search(request.params) })
    await run
    expect(useStore.getState().playground.response?.query).toBe('')
    expect(JSON.parse(useStore.getState().playground.body).query).toBe('')
  })
})
