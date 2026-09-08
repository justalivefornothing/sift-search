/**
 * Search worker: owns the SearchIndex so tokenizing, planning, scoring and
 * facet counting never touch the UI thread.
 *
 * Wire protocol (see protocol.ts): the UI posts `init` once with the dataset
 * URL, then one `query` per keystroke. Every query carries a monotonically
 * increasing id so the UI can drop stale answers that arrive out of order.
 */
import { SearchIndex } from '../engine/search-index.ts'
import type { SearchRecord } from '../engine/types.ts'
import { isWorkerRequest, type WorkerRequest, type WorkerResponse } from './protocol.ts'

const scope = self as unknown as {
  postMessage(message: WorkerResponse): void
  onmessage: ((event: MessageEvent<unknown>) => void) | null
}

let index: SearchIndex | null = null
let initializing = false

function post(message: WorkerResponse): void {
  scope.postMessage(message)
}

async function downloadWithProgress(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`dataset request failed: ${res.status} ${res.statusText}`)
  const totalBytes = Number(res.headers.get('content-length') ?? 0)
  if (!res.body) return res.text()

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let loadedBytes = 0
  post({ type: 'progress', phase: 'downloading', loadedBytes, totalBytes })
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    loadedBytes += value.byteLength
    chunks.push(decoder.decode(value, { stream: true }))
    post({ type: 'progress', phase: 'downloading', loadedBytes, totalBytes })
  }
  chunks.push(decoder.decode())
  return chunks.join('')
}

async function init(url: string): Promise<void> {
  if (index || initializing) return
  initializing = true
  try {
    const t0 = performance.now()
    const text = await downloadWithProgress(url)
    const t1 = performance.now()
    post({ type: 'progress', phase: 'parsing', loadedBytes: text.length, totalBytes: text.length })
    const records = JSON.parse(text) as SearchRecord[]
    const t2 = performance.now()
    post({ type: 'progress', phase: 'indexing', loadedBytes: 0, totalBytes: records.length })
    index = new SearchIndex(records)
    post({
      type: 'ready',
      stats: index.stats,
      downloadMs: Math.round((t1 - t0) * 10) / 10,
      parseMs: Math.round((t2 - t1) * 10) / 10,
    })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  } finally {
    initializing = false
  }
}

function handle(request: WorkerRequest): void {
  switch (request.type) {
    case 'init':
      void init(request.url)
      return
    case 'query': {
      if (!index) {
        post({ type: 'error', message: 'query received before the index was ready' })
        return
      }
      try {
        post({ type: 'result', id: request.id, response: index.search(request.params) })
      } catch (err) {
        post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
      }
      return
    }
  }
}

scope.onmessage = (event: MessageEvent<unknown>) => {
  if (isWorkerRequest(event.data)) handle(event.data)
}
