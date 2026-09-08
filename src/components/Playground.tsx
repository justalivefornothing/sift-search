import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useStore } from '../store.ts'

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(t)
  }, [copied])
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
        } catch {
          // clipboard can be unavailable in insecure contexts; fall back to selection
          const ta = document.createElement('textarea')
          ta.value = text
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          ta.remove()
          setCopied(true)
        }
      }}
      aria-label={label}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 font-mono text-[11.5px] transition-colors ${
        copied ? 'border-ok/50 bg-ok-soft text-ok' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:bg-surface-2'
      }`}
    >
      {copied ? (
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m3 8.5 3 3 7-7" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
        </svg>
      )}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function Playground() {
  const playground = useStore((s) => s.playground)
  const status = useStore((s) => s.status)
  const setOpen = useStore((s) => s.setPlaygroundOpen)
  const setBody = useStore((s) => s.setPlaygroundBody)
  const run = useStore((s) => s.runPlayground)
  const sync = useStore((s) => s.syncPlaygroundBody)

  const responseText = useMemo(() => (playground.response ? JSON.stringify(playground.response, null, 2) : ''), [playground.response])
  const curl = useMemo(
    () => `curl -X POST https://sift.local/1/indexes/records/query \\\n  -H 'content-type: application/json' \\\n  -d '${playground.body.replace(/\n\s*/g, ' ')}'`,
    [playground.body],
  )

  useEffect(() => {
    if (!playground.open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playground.open, setOpen])

  const onEditorKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void run()
    }
  }

  const open = playground.open
  const timing = playground.timing
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
        open ? 'translate-y-0' : 'translate-y-[calc(100%-2.75rem)]'
      }`}
      aria-label="API playground"
    >
      {/* handle */}
      <div className="mx-auto flex h-11 max-w-[1200px] items-end px-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="sift-playground-panel"
          className={`inline-flex h-9 items-center gap-2.5 rounded-t-xl border border-b-0 border-line bg-surface px-3.5 font-mono text-[12.5px] text-ink-2 shadow-bar transition-colors hover:bg-surface-2 ${
            open ? 'text-ink' : ''
          }`}
        >
          <span className="rounded bg-accent px-1.5 py-px text-[10.5px] font-semibold text-accent-ink">POST</span>
          <span>/1/indexes/records/query</span>
          <span className="hidden text-muted sm:inline">· API playground</span>
          <svg
            viewBox="0 0 16 16"
            className={`size-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m4 10 4-4 4 4" />
          </svg>
        </button>
      </div>

      <section
        id="sift-playground-panel"
        aria-hidden={!open}
        className="border-t border-line bg-surface shadow-[0_-12px_40px_-20px_rgb(20_20_30/0.35)]"
      >
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-px bg-line md:grid-cols-2" style={{ height: 'min(46vh, 420px)' }}>
          {/* request */}
          <div className="flex min-h-0 flex-col bg-surface">
            <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
              <div className="flex items-center gap-2 font-mono text-[11.5px] text-muted">
                <span className="font-semibold text-ink-2">Request</span>
                <span className="hidden sm:inline">application/json · editable</span>
                {playground.error && <span className="text-danger">invalid JSON</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={sync}
                  className="h-7 rounded-md border border-line bg-surface px-2 font-mono text-[11.5px] text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-2"
                  title="Reset the body to the current search state"
                >
                  Sync
                </button>
                <CopyButton text={curl} label="Copy as curl" />
                <button
                  type="button"
                  onClick={() => void run()}
                  disabled={status !== 'ready' || playground.error !== null}
                  title="Run (Ctrl/⌘ + Enter)"
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-accent px-2.5 font-mono text-[11.5px] font-medium text-accent-ink transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden="true">
                    <path d="M4 2.5v11l9-5.5z" />
                  </svg>
                  Run
                </button>
              </div>
            </div>
            <label htmlFor="sift-request-body" className="sr-only">
              Request body
            </label>
            <textarea
              id="sift-request-body"
              value={playground.body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={onEditorKey}
              spellCheck={false}
              tabIndex={open ? 0 : -1}
              className={`scrollbar-thin min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-[12.5px] leading-relaxed text-ink outline-none ${
                playground.error ? 'bg-danger/5' : ''
              }`}
            />
            {playground.error && (
              <div className="shrink-0 border-t border-danger/30 bg-danger/5 px-3 py-1.5 font-mono text-[11px] text-danger">{playground.error}</div>
            )}
          </div>

          {/* response */}
          <div className="flex min-h-0 flex-col bg-surface">
            <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
              <div className="flex items-center gap-2 font-mono text-[11.5px] text-muted">
                <span className="font-semibold text-ink-2">Response</span>
                {playground.response ? (
                  <>
                    <span className="rounded bg-ok-soft px-1.5 py-px text-[10.5px] font-semibold text-ok">200 OK</span>
                    <span className="tnum">
                      {playground.response.nbHits.toLocaleString()} hits · {timing?.engineMs.toFixed(2)} ms engine
                      {timing ? ` · ${timing.roundTripMs.toFixed(2)} ms round-trip` : ''}
                    </span>
                  </>
                ) : (
                  <span>waiting for the first query…</span>
                )}
              </div>
              <CopyButton text={responseText} label="Copy response JSON" />
            </div>
            <pre className="scrollbar-thin min-h-0 flex-1 overflow-auto p-3 font-mono text-[12px] leading-relaxed text-ink-2" tabIndex={open ? 0 : -1}>
              <code>{responseText || '// run a query to see the raw engine response'}</code>
            </pre>
          </div>
        </div>
      </section>
    </div>
  )
}
