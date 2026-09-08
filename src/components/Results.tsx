import { useCallback } from 'react'
import { countRefinements } from '../lib/url.ts'
import { HITS_PER_PAGE, useStore } from '../store.ts'
import { HitCard } from './HitCard.tsx'

function EmptyState() {
  const query = useStore((s) => s.query)
  const suggestions = useStore((s) => s.response?.suggestions ?? [])
  const refinements = useStore((s) => s.refinements)
  const applySuggestion = useStore((s) => s.applySuggestion)
  const clearRefinements = useStore((s) => s.clearRefinements)
  const filters = countRefinements(refinements)

  return (
    <div className="animate-rise flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
      <svg viewBox="0 0 48 48" className="size-12 text-muted/70" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="21" cy="21" r="12" />
        <path d="m30 30 10 10" strokeLinecap="round" />
        <path d="M15.5 21.5c1.5-2 3.5-3 5.5-3s4 1 5.5 3" strokeLinecap="round" />
        <path d="M17 16.5h.01M25 16.5h.01" strokeLinecap="round" strokeWidth="2.4" />
      </svg>
      <div>
        <h3 className="text-[15px] font-semibold text-ink">
          No results for <span className="font-mono text-ink-2">“{query}”</span>
          {filters > 0 && ` with ${filters} filter${filters === 1 ? '' : 's'}`}
        </h3>
        <p className="mt-1 text-[13px] text-muted">
          {suggestions.length > 0
            ? 'Nothing within the typo budget matched. Closest terms in the index:'
            : filters > 0
              ? 'Words matched but every hit was removed by the active filters.'
              : 'Nothing within the typo budget matched, and the trie has no close alternative.'}
        </p>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-[13px] text-muted">Did you mean</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => applySuggestion(s)}
              className="h-8 rounded-lg border border-accent/40 bg-accent-soft px-3 font-mono text-[13px] text-accent transition-colors hover:border-accent hover:bg-accent hover:text-accent-ink"
            >
              {s}
            </button>
          ))}
          <span className="text-[13px] text-muted">?</span>
        </div>
      )}
      {filters > 0 && (
        <button
          type="button"
          onClick={clearRefinements}
          className="h-8 rounded-lg border border-line bg-surface px-3 text-[13px] text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-2"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

function Pagination() {
  const page = useStore((s) => s.page)
  const nbPages = useStore((s) => s.response?.nbPages ?? 0)
  const setPage = useStore((s) => s.setPage)
  if (nbPages <= 1) return null
  const btn =
    'inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-3 text-[12.5px] text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface'
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-2">
      <button type="button" className={btn} disabled={page <= 0} onClick={() => setPage(page - 1)}>
        ← Previous
      </button>
      <span className="font-mono text-[12px] text-muted tnum">
        page {page + 1} / {nbPages}
      </span>
      <button type="button" className={btn} disabled={page >= nbPages - 1} onClick={() => setPage(page + 1)}>
        Next →
      </button>
    </nav>
  )
}

function Skeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5">
          <div className="h-4 w-2/3 animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-surface-2" />
          <div className="mt-1 h-5 w-1/2 animate-pulse rounded bg-surface-2" />
        </div>
      ))}
    </div>
  )
}

export function Results() {
  const response = useStore((s) => s.response)
  const status = useStore((s) => s.status)
  const errorMessage = useStore((s) => s.errorMessage)
  const query = useStore((s) => s.query)
  const page = useStore((s) => s.page)
  const activeHit = useStore((s) => s.activeHit)
  const explainedHit = useStore((s) => s.explainedHit)
  const setActiveHit = useStore((s) => s.setActiveHit)
  const setExplainedHit = useStore((s) => s.setExplainedHit)

  const explain = useCallback((id: string, open: boolean) => setExplainedHit(open ? id : null), [setExplainedHit])

  if (status === 'error') {
    return (
      <div role="alert" className="rounded-2xl border border-danger/40 bg-surface p-6 text-[13.5px]">
        <h3 className="font-semibold text-danger">The search worker failed</h3>
        <p className="mt-1 font-mono text-[12.5px] text-ink-2">{errorMessage}</p>
      </div>
    )
  }

  if (!response) return <Skeleton />

  const hasQuery = response.query.trim().length > 0
  const first = page * HITS_PER_PAGE + 1
  const last = Math.min(response.nbHits, first + response.hits.length - 1)

  return (
    <section aria-label="Results" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-0.5">
        <h2 className="text-[13px] font-semibold text-ink">
          {hasQuery ? 'Results' : 'Browsing by popularity'}
          <span className="ml-2 font-mono text-[12px] font-normal text-muted tnum" aria-live="polite">
            {response.nbHits === 0 ? '0 hits' : `${first.toLocaleString()}–${last.toLocaleString()} of ${response.nbHits.toLocaleString()}`}
          </span>
        </h2>
        <p className="text-[11.5px] text-muted">
          ranked by <span className="font-mono text-ink-2">typos → words → proximity → attribute → exact → popularity</span>
        </p>
      </div>

      {response.hits.length === 0 ? (
        <EmptyState />
      ) : (
        <ol className="grid gap-3 md:grid-cols-2" aria-label={`${response.nbHits} results for ${query || 'everything'}`}>
          {response.hits.map((hit, i) => (
            <li key={hit.objectID} className="min-w-0">
              <HitCard
                hit={hit}
                rank={first + i}
                active={activeHit === i}
                explained={explainedHit === hit.objectID}
                hasQuery={hasQuery}
                onActivate={() => setActiveHit(i)}
                onExplain={(open) => explain(hit.objectID, open)}
              />
            </li>
          ))}
        </ol>
      )}
      <Pagination />
    </section>
  )
}
