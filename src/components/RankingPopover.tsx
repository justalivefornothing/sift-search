import { useEffect, useRef } from 'react'
import { CRITERION_DIRECTION } from '../engine/ranker.ts'
import { ATTRIBUTES, CRITERIA, type Criterion, type Hit } from '../engine/types.ts'
import { fmtInt } from '../lib/format.ts'

const LABELS: Record<Criterion, string> = {
  typos: 'Typos',
  words: 'Words matched',
  proximity: 'Proximity',
  attribute: 'Attribute',
  exactness: 'Exactness',
  popularity: 'Popularity',
}

const HINTS: Record<Criterion, string> = {
  typos: 'total edits across matched words, fewer wins',
  words: 'distinct query words found, more wins',
  proximity: 'summed distance between consecutive words, closer wins',
  attribute: 'best field hit: title > genres > description',
  exactness: 'words matched whole rather than as a prefix, more wins',
  popularity: 'custom ranking, higher wins',
}

function formatValue(criterion: Criterion, value: number): string {
  switch (criterion) {
    case 'attribute':
      return ATTRIBUTES[value] ?? '—'
    case 'popularity':
      return fmtInt(value)
    default:
      return String(value)
  }
}

function tieBreakSentence(hit: Hit, rank: number): string {
  const tb = hit._rankingInfo.tieBreak
  if (rank === 1) return 'Top hit: nothing ranks above it.'
  if (!tb) return `Identical criteria vector to #${rank - 1}; order falls back to a stable record id.`
  const dir = CRITERION_DIRECTION[tb.criterion]
  const label = LABELS[tb.criterion].toLowerCase()
  const prevTxt = formatValue(tb.criterion, tb.previous)
  const curTxt = formatValue(tb.criterion, tb.current)
  if (tb.criterion === 'attribute') return `Tied with #${rank - 1} on typos, words and proximity; loses on attribute (${curTxt} vs ${prevTxt}).`
  const comparison = dir === 'lower' ? `${curTxt} vs ${prevTxt}, lower wins` : `${curTxt} vs ${prevTxt}, higher wins`
  const earlier = CRITERIA.slice(0, CRITERIA.indexOf(tb.criterion))
  const tied = earlier.length > 0 ? `tied with #${rank - 1} on ${earlier.map((c) => LABELS[c].toLowerCase()).join(', ')}; ` : `vs #${rank - 1}: `
  return `${tied.charAt(0).toUpperCase()}${tied.slice(1)}separated by ${label} (${comparison}).`
}

export function RankingPopover({ hit, rank, onClose }: { hit: Hit; rank: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const info = hit._rankingInfo
  const tb = info.tieBreak

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [onClose])

  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label={`Why this ranks #${rank}`}
      className="animate-pop absolute top-full right-2 z-30 -mt-1 w-[min(340px,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-3.5 text-left shadow-pop outline-none"
    >
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Why this ranks #{rank}</div>
          <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{tieBreakSentence(hit, rank)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close explanation"
          className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <ol className="flex flex-col divide-y divide-line/70 rounded-lg border border-line/80 bg-surface-2/40 text-[12.5px]">
        {CRITERIA.map((c, i) => {
          const isBreak = tb?.criterion === c
          const decided = tb ? i <= CRITERIA.indexOf(tb.criterion) : false
          return (
            <li
              key={c}
              className={`grid grid-cols-[18px_1fr_auto] items-center gap-2 px-2.5 py-1.5 ${isBreak ? 'bg-accent-soft/70 text-ink' : decided || !tb ? 'text-ink-2' : 'text-muted'}`}
              title={HINTS[c]}
            >
              <span className={`font-mono text-[10.5px] ${isBreak ? 'text-accent' : 'text-muted'}`}>{i + 1}</span>
              <span className="flex items-center gap-1.5">
                <span className={isBreak ? 'font-medium' : ''}>{LABELS[c]}</span>
                <span className="font-mono text-[10px] text-muted">{CRITERION_DIRECTION[c] === 'lower' ? '↓' : '↑'}</span>
                {isBreak && <span className="rounded bg-accent px-1 py-px font-mono text-[9.5px] font-medium text-accent-ink uppercase whitespace-nowrap">tie-break</span>}
              </span>
              <span className="text-right font-mono tnum">
                {c === 'proximity' && info.words < 2 ? 'n/a' : c === 'attribute' && info.attributeName === 'none' ? '—' : formatValue(c, info[c])}
                {isBreak && tb && <span className="text-muted"> vs {formatValue(c, tb.previous)}</span>}
              </span>
            </li>
          )
        })}
      </ol>

      {info.matchedTerms.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">Matched terms</div>
          <ul className="flex flex-wrap gap-1">
            {info.matchedTerms.slice(0, 12).map((m) => (
              <li
                key={`${m.word}:${m.term}`}
                className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-2"
                title={`query “${m.word}” matched index term “${m.term}”`}
              >
                <span className="text-muted">{m.word}</span>
                <span className="text-muted/60">→</span>
                <span>{m.term}</span>
                <span className={`ml-0.5 text-[9.5px] ${m.typos > 0 ? 'text-warn' : 'text-ok'}`}>
                  {m.typos > 0 ? `${m.typos}t` : m.exact ? 'exact' : 'prefix'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
