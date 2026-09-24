/**
 * UI-side client for the search worker. Hand-rolled request/response matching
 * over postMessage: every query gets an id, in-flight promises live in a map,
 * and answers older than the latest request are resolved as `stale` so the UI
 * never paints an outdated result over a newer one.
 */
import type { IndexStats, QueryParams, QueryResponse } from '../engine/types.ts'
import { isQueryParams } from '../engine/params.ts'
import { isWorkerResponse, requestId, type LoadPhase, type WorkerRequest } from './protocol.ts'

export interface QueryResult {
  response: QueryResponse
  /** wall-clock time from postMessage to the answer landing on the UI thread */
  roundTripMs: number
  /** true when a newer query was issued before this answer arrived */
  stale: boolean
}

export interface ReadyInfo {
  stats: IndexStats
  downloadMs: number
  parseMs: number
}

export interface ProgressInfo {
  phase: LoadPhase
  loadedBytes: number
  totalBytes: number
}

export interface SearchClientEvents {
  progress?(info: ProgressInfo): void
  ready?(info: ReadyInfo): void
  error?(message: string): void
}

interface Pending {
  sentAt: number
  channel: QueryChannel
  resolve(result: QueryResult): void
  reject(error: Error): void
}

type QueryChannel = 'search' | 'playground'

export class SearchClient {
  private readonly worker: Worker
  private readonly pending = new Map<number, Pending>()
  private nextId = 1
  private readonly latestIds = new Map<QueryChannel, number>()
  private readonly events: SearchClientEvents
  private failure: Error | null = null

  constructor(worker: Worker, events: SearchClientEvents = {}) {
    this.worker = worker
    this.events = events
    worker.onmessage = (event: MessageEvent<unknown>) => this.receive(event.data)
    worker.onerror = (event) => this.fail(new Error(event.message || 'worker crashed'))
    worker.onmessageerror = () => this.fail(new Error('Could not read the search worker response'))
  }

  init(url: string): void {
    if (this.failure) return
    try {
      this.send({ type: 'init', url })
    } catch (error) {
      this.fail(asError(error))
    }
  }

  query(params: QueryParams, channel: QueryChannel = 'search'): Promise<QueryResult> {
    if (this.failure) return Promise.reject(this.failure)
    if (!isQueryParams(params)) return Promise.reject(new Error('Invalid query parameters'))
    const id = this.nextId++
    this.latestIds.set(channel, id)
    return new Promise<QueryResult>((resolve, reject) => {
      this.pending.set(id, { sentAt: performance.now(), channel, resolve, reject })
      try {
        this.send({ type: 'query', id, params })
      } catch (error) {
        this.rejectRequest(id, asError(error))
      }
    })
  }

  terminate(): void {
    this.worker.terminate()
    this.failure = new Error('Search worker terminated')
    this.rejectAll(this.failure)
  }

  private rejectRequest(id: number, error: Error): void {
    const pending = this.pending.get(id)
    if (!pending) return
    this.pending.delete(id)
    pending.reject(error)
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
  }

  private fail(error: Error): void {
    if (this.failure) return
    this.failure = error
    this.rejectAll(error)
    this.events.error?.(error.message)
  }

  private send(request: WorkerRequest): void {
    this.worker.postMessage(request)
  }

  private receive(data: unknown): void {
    if (this.failure) return
    if (!isWorkerResponse(data)) {
      const id = requestId(data)
      if (id !== undefined) this.rejectRequest(id, new Error('Invalid search worker response'))
      return
    }
    switch (data.type) {
      case 'progress':
        this.events.progress?.({ phase: data.phase, loadedBytes: data.loadedBytes, totalBytes: data.totalBytes })
        return
      case 'ready':
        this.events.ready?.({ stats: data.stats, downloadMs: data.downloadMs, parseMs: data.parseMs })
        return
      case 'error':
        if (data.id !== undefined) this.rejectRequest(data.id, new Error(data.message))
        else this.fail(new Error(data.message))
        return
      case 'result': {
        const pending = this.pending.get(data.id)
        if (!pending) return
        this.pending.delete(data.id)
        pending.resolve({
          response: data.response,
          roundTripMs: Math.round((performance.now() - pending.sentAt) * 100) / 100,
          stale: data.id !== this.latestIds.get(pending.channel),
        })
        return
      }
    }
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/** Spawn the module worker with Vite's URL syntax so it is bundled separately. */
export function createSearchWorker(): Worker {
  return new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module', name: 'sift-search' })
}
