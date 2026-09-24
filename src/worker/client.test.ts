import { describe, expect, it, vi } from 'vitest'
import { SearchIndex } from '../engine/search-index.ts'
import type { QueryParams } from '../engine/types.ts'
import { SearchClient } from './client.ts'
import type { WorkerRequest } from './protocol.ts'

class FakeWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  onmessageerror: (() => void) | null = null
  messages: WorkerRequest[] = []
  postMessage(message: WorkerRequest) { this.messages.push(message) }
  terminate = vi.fn()
  emit(data: unknown) { this.onmessage?.({ data } as MessageEvent<unknown>) }
}

const response = new SearchIndex([]).search({ query: '' })

function setup() {
  const worker = new FakeWorker()
  const error = vi.fn()
  return { worker, error, client: new SearchClient(worker as unknown as Worker, { error }) }
}

describe('SearchClient lifecycle', () => {
  it('rejects a failed request and processes a later successful query', async () => {
    const { worker, client, error } = setup()
    const first = client.query({ query: 'matrix' })
    const rejected = expect(first).rejects.toThrow('bad query')
    worker.emit({ type: 'error', id: 1, message: 'bad query' })
    await rejected
    expect(error).not.toHaveBeenCalled()
    // A late response cannot settle the already rejected request.
    worker.emit({ type: 'result', id: 1, response })
    const second = client.query({ query: '' })
    worker.emit({ type: 'result', id: 2, response })
    await expect(second).resolves.toMatchObject({ response, stale: false })
  })

  it('rejects invalid parameters locally without superseding an in-flight search', async () => {
    const { worker, client } = setup()
    const valid = client.query({ query: '' })
    await expect(client.query({ query: 'matrix', facets: 3 } as unknown as QueryParams)).rejects.toThrow('Invalid query parameters')
    expect(worker.messages).toHaveLength(1)
    worker.emit({ type: 'result', id: 1, response })
    await expect(valid).resolves.toMatchObject({ stale: false })
  })

  it('settles every pending query on termination and rejects future queries', async () => {
    const { worker, client } = setup()
    const first = expect(client.query({ query: 'one' })).rejects.toThrow('terminated')
    const second = expect(client.query({ query: 'two' })).rejects.toThrow('terminated')
    client.terminate()
    await Promise.all([first, second])
    await expect(client.query({ query: 'three' })).rejects.toThrow('terminated')
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it.each(['error', 'messageerror', 'fatal response'])('settles pending queries after %s', async (kind) => {
    const { worker, client, error } = setup()
    const pending = expect(client.query({ query: '' })).rejects.toThrow()
    if (kind === 'error') worker.onerror?.({ message: 'worker crashed' })
    else if (kind === 'messageerror') worker.onmessageerror?.()
    else worker.emit({ type: 'error', message: 'index failed' })
    await pending
    expect(error).toHaveBeenCalledOnce()
    await expect(client.query({ query: '' })).rejects.toThrow()
  })

  it('rejects malformed matching responses without disabling later requests', async () => {
    const { worker, client, error } = setup()
    const pending = expect(client.query({ query: '' })).rejects.toThrow('Invalid search worker response')
    worker.emit({ type: 'result', id: 1, response: {} })
    await pending
    expect(error).not.toHaveBeenCalled()
    const next = client.query({ query: '' })
    worker.emit({ type: 'result', id: 2, response })
    await expect(next).resolves.toMatchObject({ response })
  })

  it('handles a synchronous postMessage failure and permits retry', async () => {
    const { worker, client } = setup()
    vi.spyOn(worker, 'postMessage').mockImplementationOnce(() => { throw new Error('could not clone request') })
    await expect(client.query({ query: '' })).rejects.toThrow('could not clone request')
    const next = client.query({ query: '' })
    worker.emit({ type: 'result', id: 2, response })
    await expect(next).resolves.toMatchObject({ response })
  })

  it('reports an initialization send failure and rejects subsequent queries', async () => {
    const { worker, client, error } = setup()
    vi.spyOn(worker, 'postMessage').mockImplementationOnce(() => { throw new Error('could not initialize') })
    client.init('/data/records.json')
    expect(error).toHaveBeenCalledWith('could not initialize')
    await expect(client.query({ query: '' })).rejects.toThrow('could not initialize')
  })

  it('separates playground requests from search staleness while dropping old search results', async () => {
    const { worker, client } = setup()
    const first = client.query({ query: 'old' })
    const latest = client.query({ query: '' })
    const playground = client.query({ query: '' }, 'playground')
    worker.emit({ type: 'result', id: 2, response })
    worker.emit({ type: 'result', id: 3, response })
    worker.emit({ type: 'result', id: 1, response })
    await expect(first).resolves.toMatchObject({ stale: true })
    await expect(latest).resolves.toMatchObject({ stale: false })
    await expect(playground).resolves.toMatchObject({ stale: false })
  })
})
