import { useEffect, useState } from 'react'
import { FacetRail } from './components/FacetRail.tsx'
import { Header } from './components/Header.tsx'
import { Playground } from './components/Playground.tsx'
import { Results } from './components/Results.tsx'
import { SearchBar } from './components/SearchBar.tsx'
import { countRefinements } from './lib/url.ts'
import { useStore } from './store.ts'

export default function App() {
  const boot = useStore((s) => s.boot)
  const status = useStore((s) => s.status)
  const progress = useStore((s) => s.progress)
  const refinements = useStore((s) => s.refinements)
  const playgroundOpen = useStore((s) => s.playground.open)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    boot()
  }, [boot])

  const activeFilters = countRefinements(refinements)

  return (
    <div className={`flex min-h-dvh flex-col transition-[padding] duration-300 ${playgroundOpen ? 'pb-[min(46vh,420px)]' : ''}`}>
      <Header />

      <main className="flex-1">
        <section className="px-4 pt-10 pb-6 sm:pt-14 sm:pb-8">
          <h1 className="sr-only">Sift — typo-tolerant search-as-you-type engine</h1>
          <SearchBar />
          {status === 'loading' && progress && (
            <p className="mt-3 text-center font-mono text-[11.5px] text-muted" aria-live="polite">
              {progress.phase === 'downloading' && progress.totalBytes > 0
                ? `downloading dataset ${Math.round((progress.loadedBytes / progress.totalBytes) * 100)}%`
                : progress.phase === 'parsing'
                  ? 'parsing JSON…'
                  : 'building inverted index + trie + facet bitsets…'}
            </p>
          )}
        </section>

        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 px-4 pb-16 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-10">
          {/* small screens: collapsible filters */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls="sift-filters-mobile"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 4h12M4.5 8h7M7 12h2" />
              </svg>
              Filters
              {activeFilters > 0 && <span className="rounded-full bg-accent px-1.5 font-mono text-[10.5px] text-accent-ink">{activeFilters}</span>}
            </button>
            {filtersOpen && (
              <div id="sift-filters-mobile" className="animate-rise mt-3 rounded-xl border border-line bg-surface p-3">
                <FacetRail />
              </div>
            )}
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-[4.5rem]">
              <FacetRail />
            </div>
          </div>

          <Results />
        </div>
      </main>

      <footer className="border-t border-line/80 px-4 py-5 text-center text-[11.5px] text-muted">
        Every piece of the engine — tokenizer, radix trie, bounded Damerau-Levenshtein, positional inverted index, tiered ranker, bitset facets — is
        hand-written TypeScript in <code className="font-mono text-ink-2">src/engine/</code>, running off the main thread. Concept inspired by Algolia; implementation original.
      </footer>

      <Playground />
    </div>
  )
}
