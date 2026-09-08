/**
 * UI-side client for the search worker. Hand-rolled request/response matching
 * over postMessage: every query gets an id, in-flight promises live in a map,
 * and answers older than the latest request are resolved as `stale` so the UI
 * never paints an outdated result over a newer one.
 */
import type { IndexStats, QueryParams, QueryResponse } from '../engine/types.ts'
import { isWorkerResponse, type LoadPhase, type WorkerRequest } from './protocol.ts'

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
  resolve(result: QueryResult): void
}

export class SearchClient {
  private readonly worker: Worker
  private readonly pending = new Map<number, Pending>()
  private nextId = 1
  private latestId = 0
  private readonly events: SearchClientEvents

  constructor(worker: Worker, events: SearchClientEvents = {}) {
    this.worker = worker
    this.events = events
    worker.onmessage = (event: MessageEvent<unknown>) => this.receive(event.data)
    worker.onerror = (event) => this.events.error?.(event.message || 'worker crashed')
  }

  init(url: string): void {
    this.send({ type: 'init', url })
  }

  query(params: QueryParams): Promise<QueryResult> {
    const id = this.nextId++
    this.latestId = id
    return new Promise<QueryResult>((resolve) => {
      this.pending.set(id, { sentAt: performance.now(), resolve })
      this.send({ type: 'query', id, params })
    })
  }

  terminate(): void {
    this.worker.terminate()
    this.pending.clear()
  }

  private send(request: WorkerRequest): void {
    this.worker.postMessage(request)
  }

  private receive(data: unknown): void {
    if (!isWorkerResponse(data)) return
    switch (data.type) {
      case 'progress':
        this.events.progress?.({ phase: data.phase, loadedBytes: data.loadedBytes, totalBytes: data.totalBytes })
        return
      case 'ready':
        this.events.ready?.({ stats: data.stats, downloadMs: data.downloadMs, parseMs: data.parseMs })
        return
      case 'error':
        this.events.error?.(data.message)
        return
      case 'result': {
        const pending = this.pending.get(data.id)
        if (!pending) return
        this.pending.delete(data.id)
        pending.resolve({
          response: data.response,
          roundTripMs: Math.round((performance.now() - pending.sentAt) * 100) / 100,
          stale: data.id !== this.latestId,
        })
        return
      }
    }
  }
}

/** Spawn the module worker with Vite's URL syntax so it is bundled separately. */
export function createSearchWorker(): Worker {
  return new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module', name: 'sift-search' })
}
