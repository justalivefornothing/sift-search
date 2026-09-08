import { useState } from 'react'
import { RATING_BUCKETS } from '../engine/facets.ts'
import { countRefinements, FACET_NAMES, type FacetName } from '../lib/url.ts'
import { useStore } from '../store.ts'

const LABELS: Record<FacetName, string> = { genre: 'Genre', decade: 'Decade', rating: 'Rating' }
const COLLAPSED_LIMIT = 8

function sortValues(facet: FacetName, table: Record<string, number>, selected: string[]): [string, number][] {
  const entries = Object.entries(table)
  if (facet === 'decade') return entries.sort((a, b) => b[0].localeCompare(a[0]))
  if (facet === 'rating') {
    const order = RATING_BUCKETS as readonly string[]
    return entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
  }
  // genres: selected first, then by count desc, then alphabetically
  return entries.sort((a, b) => {
    const sa = selected.includes(a[0]) ? 0 : 1
    const sb = selected.includes(b[0]) ? 0 : 1
    return sa - sb || b[1] - a[1] || a[0].localeCompare(b[0])
  })
}

function FacetGroup({ facet }: { facet: FacetName }) {
  const table = useStore((s) => s.response?.facets[facet])
  const selected = useStore((s) => s.refinements[facet])
  const toggleFacet = useStore((s) => s.toggleFacet)
  const [expanded, setExpanded] = useState(false)

  if (!table) return null
  const values = sortValues(facet, table, selected)
  const max = values.reduce((m, [, c]) => Math.max(m, c), 1)
  const visible = expanded || values.length <= COLLAPSED_LIMIT ? values : values.slice(0, COLLAPSED_LIMIT)
  const hidden = values.length - visible.length

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 flex w-full items-baseline justify-between text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
        <span>{LABELS[facet]}</span>
        {selected.length > 0 && <span className="font-mono text-[10.5px] text-accent normal-case tracking-normal">{selected.length} selected · OR</span>}
      </legend>
      <ul className="flex flex-col gap-px">
        {visible.map(([value, count]) => {
          const on = selected.includes(value)
          const id = `facet-${facet}-${value.replace(/[^a-z0-9]+/gi, '-')}`
          return (
            <li key={value}>
              <label
                htmlFor={id}
                className={`group relative flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[13.5px] transition-colors select-none hover:bg-surface-2 has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                  on ? 'text-ink' : count === 0 ? 'text-muted' : 'text-ink-2'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-1.5 left-0 -z-0 rounded-md bg-accent-soft/60 transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.round((count / max) * 100)}%`, opacity: on ? 1 : 0.55 }}
                />
                <input
                  id={id}
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleFacet(facet, value)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`relative z-10 grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors ${
                    on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface group-hover:border-accent/60'
                  }`}
                >
                  {on && (
                    <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m2.5 6.5 2.5 2.5 4.5-5" />
                    </svg>
                  )}
                </span>
                <span className="relative z-10 min-w-0 flex-1 truncate">{value}</span>
                <span className="relative z-10 font-mono text-[11.5px] text-muted tnum">{count.toLocaleString()}</span>
              </label>
            </li>
          )
        })}
      </ul>
      {(hidden > 0 || expanded) && values.length > COLLAPSED_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 h-7 rounded-md px-2 text-[12px] text-accent transition-colors hover:bg-accent-soft"
        >
          {expanded ? 'Show fewer' : `Show ${hidden} more`}
        </button>
      )}
    </fieldset>
  )
}

export function FacetRail() {
  const refinements = useStore((s) => s.refinements)
  const clearRefinements = useStore((s) => s.clearRefinements)
  const hasResponse = useStore((s) => s.response !== null)
  const active = countRefinements(refinements)

  return (
    <aside aria-label="Filters" className="flex flex-col gap-5">
      <div className="flex h-7 items-center justify-between">
        <h2 className="text-[13px] font-semibold text-ink">Filters</h2>
        {active > 0 && (
          <button
            type="button"
            onClick={clearRefinements}
            className="h-7 rounded-md px-2 text-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Clear {active}
          </button>
        )}
      </div>
      {hasResponse ? (
        FACET_NAMES.map((facet) => <FacetGroup key={facet} facet={facet} />)
      ) : (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-7 animate-pulse rounded-lg bg-surface-2" style={{ width: `${60 + ((i * 17) % 40)}%` }} />
          ))}
        </div>
      )}
      <p className="text-[11.5px] leading-relaxed text-muted">
        Counts are computed live from the current result set with bitset intersections. Values within a facet are OR-ed, facets are AND-ed.
      </p>
    </aside>
  )
}
