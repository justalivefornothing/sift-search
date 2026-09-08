import { useStore } from '../store.ts'

function fmtMs(ms: number): string {
  if (ms >= 100) return ms.toFixed(0)
  if (ms >= 10) return ms.toFixed(1)
  return ms.toFixed(2)
}

/**
 * Monospace readout of engine time, round-trip time and hit count. Re-runs a
 * short green flash animation on every applied result.
 */
export function LatencyPill() {
  const timing = useStore((s) => s.timing)
  const nbHits = useStore((s) => s.response?.nbHits)
  const status = useStore((s) => s.status)
  // keying on the tick remounts the pill so the flash animation restarts every query
  const flashKey = timing.tick

  const ready = status === 'ready' && nbHits !== undefined
  return (
    <div
      key={flashKey}
      aria-label={ready ? `${fmtMs(timing.engineMs)} milliseconds engine time, ${nbHits} hits` : 'engine loading'}
      title={ready ? `engine ${fmtMs(timing.engineMs)} ms · worker round-trip ${fmtMs(timing.roundTripMs)} ms` : undefined}
      className={`inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface px-3 font-mono text-[12.5px] leading-none text-ink-2 tnum ${
        flashKey > 0 ? 'animate-flash' : ''
      }`}
    >
      {ready ? (
        <>
          <span className="inline-block size-1.5 rounded-full bg-ok" aria-hidden="true" />
          <span>
            <span className="font-medium">{fmtMs(timing.engineMs)}</span>
            <span className="text-muted"> ms</span>
          </span>
          <span className="text-line-strong" aria-hidden="true">
            ·
          </span>
          <span className="hidden sm:inline">
            <span>{fmtMs(timing.roundTripMs)}</span>
            <span className="text-muted"> rt</span>
          </span>
          <span className="hidden text-line-strong sm:inline" aria-hidden="true">
            ·
          </span>
          <span>
            <span className="font-medium">{nbHits.toLocaleString()}</span>
            <span className="text-muted"> hits</span>
          </span>
        </>
      ) : (
        <>
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-warn" aria-hidden="true" />
          <span className="text-muted">{status === 'error' ? 'engine error' : 'indexing…'}</span>
        </>
      )}
    </div>
  )
}
