import { fmtInt } from '../lib/format.ts'
import { useStore } from '../store.ts'
import { LatencyPill } from './LatencyPill.tsx'
import { Logo } from './Logo.tsx'

function fmtBytes(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

export function Header() {
  const ready = useStore((s) => s.ready)
  const status = useStore((s) => s.status)
  const progress = useStore((s) => s.progress)
  const playgroundOpen = useStore((s) => s.playground.open)
  const setPlaygroundOpen = useStore((s) => s.setPlaygroundOpen)

  const pct =
    progress && progress.totalBytes > 0
      ? progress.phase === 'downloading'
        ? Math.round((progress.loadedBytes / progress.totalBytes) * 70)
        : progress.phase === 'parsing'
          ? 80
          : 92
      : status === 'ready'
        ? 100
        : 8

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4">
        <a href="./" className="flex items-center gap-2.5 rounded-lg text-ink" aria-label="Sift home">
          <Logo />
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight">Sift</span>
            <span className="hidden text-[10.5px] text-muted sm:block">search-as-you-type · in a Web Worker</span>
          </span>
        </a>

        <div className="ml-auto flex items-center gap-2">
          {ready && (
            <div
              className="hidden items-center gap-3 font-mono text-[11px] text-muted lg:flex"
              title={`index built in ${ready.stats.indexTimeMs} ms · download ${ready.downloadMs} ms · JSON parse ${ready.parseMs} ms`}
            >
              <span>
                <span className="text-ink-2">{fmtInt(ready.stats.records)}</span> records
              </span>
              <span>
                <span className="text-ink-2">{fmtInt(ready.stats.terms)}</span> terms
              </span>
              <span>
                <span className="text-ink-2">{fmtInt(ready.stats.postings)}</span> postings
              </span>
              <span>
                <span className="text-ink-2">{fmtBytes(ready.stats.approxBytes)}</span> index
              </span>
              <span>
                indexed in <span className="text-ink-2">{Math.round(ready.stats.indexTimeMs)} ms</span>
              </span>
            </div>
          )}
          <LatencyPill />
          <button
            type="button"
            onClick={() => setPlaygroundOpen(!playgroundOpen)}
            aria-pressed={playgroundOpen}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 font-mono text-[12px] transition-colors ${
              playgroundOpen
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:bg-surface-2'
            }`}
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 4-3 4 3 4M11 4l3 4-3 4M9.5 2.5l-3 11" />
            </svg>
            API
          </button>
        </div>
      </div>
      {status !== 'ready' && status !== 'error' && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Loading and indexing the dataset">
          <div className="h-full bg-accent transition-[width] duration-200 ease-out" style={{ width: `${pct}%` }} />
        </div>
      )}
    </header>
  )
}
