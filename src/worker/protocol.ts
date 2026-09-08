/**
 * Hand-rolled postMessage protocol between the UI thread and the search worker.
 * Plain discriminated unions — no Comlink, no proxies — so the wire format is
 * obvious and testable.
 */
import type { IndexStats, QueryParams, QueryResponse } from '../engine/types.ts'

export type WorkerRequest =
  | { type: 'init'; url: string }
  | { type: 'query'; id: number; params: QueryParams }

export type LoadPhase = 'downloading' | 'parsing' | 'indexing'

export type WorkerResponse =
  | { type: 'progress'; phase: LoadPhase; loadedBytes: number; totalBytes: number }
  | { type: 'ready'; stats: IndexStats; downloadMs: number; parseMs: number }
  | { type: 'result'; id: number; response: QueryResponse }
  | { type: 'error'; message: string }

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (typeof value !== 'object' || value === null) return false
  const t = (value as { type?: unknown }).type
  return t === 'progress' || t === 'ready' || t === 'result' || t === 'error'
}

export function isWorkerRequest(value: unknown): value is WorkerRequest {
  if (typeof value !== 'object' || value === null) return false
  const t = (value as { type?: unknown }).type
  return t === 'init' || t === 'query'
}
