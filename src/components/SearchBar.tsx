import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useStore } from '../store.ts'

/**
 * Centered 720px search bar. Every keystroke queries the worker (no debounce).
 * Arrow keys move the active hit, Enter opens its explainer, Escape clears.
 */
export function SearchBar() {
  const query = useStore((s) => s.query)
  const status = useStore((s) => s.status)
  const setQuery = useStore((s) => s.setQuery)
  const moveActiveHit = useStore((s) => s.moveActiveHit)
  const parsed = useStore((s) => s.response?.parsedQuery)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  // "/" focuses the search box from anywhere (unless already typing somewhere)
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const state = useStore.getState()
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moveActiveHit(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        moveActiveHit(-1)
        break
      case 'Enter': {
        const hit = state.response?.hits[state.activeHit]
        if (hit) {
          e.preventDefault()
          state.setExplainedHit(state.explainedHit === hit.objectID ? null : hit.objectID)
        }
        break
      }
      case 'Escape':
        if (state.explainedHit) state.setExplainedHit(null)
        else if (state.activeHit >= 0) state.setActiveHit(-1)
        else if (query) setQuery('')
        break
    }
  }

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <label htmlFor="sift-query" className="sr-only">
        Search 10,000 records
      </label>
      <div className="group relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="9" cy="9" r="5.5" />
          <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          id="sift-query"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={status === 'ready' ? 'Search titles, genres, loglines… try “matrx” or “blade runer”' : 'Indexing 10,000 records…'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-describedby="sift-query-help"
          className="h-14 w-full rounded-2xl border border-line bg-surface pr-24 pl-12 text-[17px] text-ink shadow-bar transition-[box-shadow,border-color,transform] duration-200 ease-out outline-none placeholder:text-muted/80 hover:border-line-strong focus:border-accent/60 focus:shadow-bar-focus motion-safe:focus:scale-[1.01] sm:h-15 sm:text-lg [&::-webkit-search-cancel-button]:hidden"
        />
        <div className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1.5">
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              aria-label="Clear query"
              className="pointer-events-auto grid size-7 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="m4 4 8 8M12 4l-8 8" />
              </svg>
            </button>
          ) : (
            <kbd className="hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted sm:inline-block">/</kbd>
          )}
        </div>
      </div>
      <div id="sift-query-help" className="mt-2.5 flex min-h-5 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-1 text-[12px] text-muted">
        {parsed && parsed.length > 0 ? (
          <>
            <span className="sr-only">Query plan:</span>
            {parsed.map((w, i) => (
              <span key={`${w.word}-${i}`} className="inline-flex items-center gap-1 font-mono">
                <span className="text-ink-2">{w.word}</span>
                <span className="text-line-strong" aria-hidden="true">
                  ·
                </span>
                <span title="typo budget for this word">{w.maxTypos === 0 ? 'exact' : `≤${w.maxTypos} typo${w.maxTypos > 1 ? 's' : ''}`}</span>
                {w.prefix && <span className="rounded bg-surface-3 px-1 text-[10.5px] text-ink-2">prefix</span>}
                <span className="text-muted/70">{w.candidates} term{w.candidates === 1 ? '' : 's'}</span>
              </span>
            ))}
          </>
        ) : (
          <span>
            Typo-tolerant search over 10,000 records · runs in a Web Worker · <kbd className="font-mono">↑↓</kbd> to move,{' '}
            <kbd className="font-mono">Enter</kbd> to explain a rank
          </span>
        )}
      </div>
    </div>
  )
}
