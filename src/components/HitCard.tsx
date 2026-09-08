import { memo, useEffect, useRef } from 'react'
import type { Hit } from '../engine/types.ts'
import { fmtInt } from '../lib/format.ts'
import { Highlighted } from './Highlighted.tsx'
import { RankingPopover } from './RankingPopover.tsx'

interface Props {
  hit: Hit
  rank: number
  active: boolean
  explained: boolean
  hasQuery: boolean
  onActivate: () => void
  onExplain: (open: boolean) => void
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1 tnum" title={`rating ${rating.toFixed(1)} / 10`}>
      <svg viewBox="0 0 16 16" className="size-3 text-warn" fill="currentColor" aria-hidden="true">
        <path d="M8 1.5l1.9 4.1 4.4.5-3.3 3 .9 4.4L8 11.3l-3.9 2.2.9-4.4-3.3-3 4.4-.5z" />
      </svg>
      {rating.toFixed(1)}
    </span>
  )
}

export const HitCard = memo(function HitCard({ hit, rank, active, explained, hasQuery, onActivate, onExplain }: Props) {
  const ref = useRef<HTMLElement>(null)
  const info = hit._rankingInfo

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const summary = hasQuery
    ? `${info.typos} typo${info.typos === 1 ? '' : 's'} · ${info.words} word${info.words === 1 ? '' : 's'} · ${info.attributeName}`
    : `popularity ${fmtInt(hit.popularity)}`

  return (
    <article
      ref={ref}
      data-active={active || undefined}
      onMouseEnter={onActivate}
      aria-current={active ? 'true' : undefined}
      className={`animate-rise relative flex flex-col gap-2 rounded-xl border bg-surface p-3.5 shadow-card transition-[border-color,box-shadow,background-color] duration-150 ${
        active ? 'border-accent/70 ring-2 ring-accent/15' : 'border-line hover:border-line-strong'
      } ${explained ? 'z-20' : ''}`}
    >
      <header className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 grid h-5 min-w-5 shrink-0 place-items-center rounded-md px-1 font-mono text-[10.5px] font-medium tnum ${
            rank === 1 && hasQuery ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted'
          }`}
          aria-label={`rank ${rank}`}
        >
          {rank}
        </span>
        <h3 className="min-w-0 flex-1 text-[15px] leading-snug font-semibold text-ink [text-wrap:balance]">
          <Highlighted value={hit._highlightResult.title.value} />
        </h3>
        <span className="shrink-0 font-mono text-[12px] text-muted tnum">{hit.year}</span>
      </header>

      <p className="text-[13px] leading-relaxed text-ink-2">
        <Highlighted value={hit._snippetResult.description.value} />
      </p>

      <footer className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5 text-[12px] text-muted">
        <ul className="flex flex-wrap gap-1" aria-label="genres">
          {hit._highlightResult.genres.map((g, i) => (
            <li
              key={hit.genres[i]}
              className={`rounded-md border px-1.5 py-px text-[11px] ${
                g.matchLevel !== 'none' ? 'border-mark bg-mark/40 text-ink' : 'border-line bg-surface-2/60 text-ink-2'
              }`}
            >
              <Highlighted value={g.value} />
            </li>
          ))}
        </ul>
        <Stars rating={hit.rating} />
        <span className="hidden font-mono text-[11px] tnum sm:inline" title="popularity (custom ranking attribute)">
          pop {fmtInt(hit.popularity)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden font-mono text-[11px] text-muted md:inline" aria-hidden="true">
            {summary}
          </span>
          <button
            type="button"
            onClick={() => onExplain(!explained)}
            aria-expanded={explained}
            aria-haspopup="dialog"
            className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11.5px] font-medium transition-colors ${
              explained
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line bg-surface text-ink-2 hover:border-accent/50 hover:bg-accent-soft hover:text-accent'
            }`}
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="8" cy="8" r="6.2" />
              <path d="M8 7.2v4M8 4.8v.2" />
            </svg>
            Why #{rank}?
          </button>
        </div>
      </footer>

      {explained && <RankingPopover hit={hit} rank={rank} onClose={() => onExplain(false)} />}
    </article>
  )
})
