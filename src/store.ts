/**
 * UI state. One Zustand store owns the worker client, the current search
 * state (query, refinements, page), the latest response and timing, and keeps
 * the URL in sync. Every keystroke queries immediately (0 ms debounce) — the
 * client marks out-of-order answers as stale so they are simply dropped.
 */
import { create } from 'zustand'
import type { QueryParams, QueryResponse } from './engine/types.ts'
import { parseQueryBody } from './engine/params.ts'
import {
  emptyRefinements,
  parseSearchParams,
  serializeSearchParams,
  toQueryParams,
  toggleRefinement,
  type FacetName,
  type SearchState,
} from './lib/url.ts'
import { createSearchWorker, SearchClient, type ProgressInfo, type ReadyInfo } from './worker/client.ts'

export const HITS_PER_PAGE = 20
export const DATASET_URL = `${import.meta.env.BASE_URL}data/records.json`

export type EngineStatus = 'booting' | 'loading' | 'ready' | 'error'

export interface Timing {
  engineMs: number
  roundTripMs: number
  /** increments on every applied result so the latency pill can re-trigger its flash */
  tick: number
}

export interface PlaygroundState {
  open: boolean
  /** raw editable JSON body of the mock request */
  body: string
  /** parse error for the body, if any */
  error: string | null
  response: QueryResponse | null
  timing: Timing | null
}

interface StoreState extends SearchState {
  status: EngineStatus
  progress: ProgressInfo | null
  ready: ReadyInfo | null
  errorMessage: string | null

  response: QueryResponse | null
  timing: Timing
  /** index of the keyboard-selected hit, -1 for none */
  activeHit: number
  /** objectID of the hit whose explainer popover is open */
  explainedHit: string | null
  /** ?explain=N deep link waiting for the first response */
  pendingExplain: number | null

  playground: PlaygroundState

  boot(): void
  setQuery(query: string): void
  toggleFacet(facet: FacetName, value: string): void
  clearRefinements(): void
  setPage(page: number): void
  applySuggestion(query: string): void
  setActiveHit(index: number): void
  moveActiveHit(delta: number): void
  setExplainedHit(id: string | null): void
  hydrateFromUrl(): void

  setPlaygroundOpen(open: boolean): void
  setPlaygroundBody(body: string): void
  runPlayground(): Promise<void>
  syncPlaygroundBody(): void
}

let client: SearchClient | null = null

function playgroundBodyFor(params: QueryParams): string {
  const body: Record<string, unknown> = { query: params.query, hitsPerPage: params.hitsPerPage ?? HITS_PER_PAGE, page: params.page ?? 0 }
  if (params.facetFilters && params.facetFilters.length > 0) body.facetFilters = params.facetFilters
  body.facets = params.facets ?? ['genre', 'decade', 'rating']
  return JSON.stringify(body, null, 2)
}

export const useStore = create<StoreState>((set, get) => {
  let queryVersion = 0
  let playgroundVersion = 0
  const currentParams = (): QueryParams => {
    const { query, refinements, page } = get()
    return toQueryParams({ query, refinements, page }, HITS_PER_PAGE)
  }

  const pushUrl = (): void => {
    if (typeof window === 'undefined') return
    const { query, refinements, page } = get()
    const qs = serializeSearchParams({ query, refinements, page })
    const next = `${window.location.pathname}${qs}`
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', next)
  }

  const runQuery = async (): Promise<void> => {
    const version = ++queryVersion
    const params = currentParams()
    pushUrl()
    // before the index is ready the 'ready' handler re-runs the current state
    if (!client || get().status !== 'ready') return
    set({ errorMessage: null })
    try {
      const result = await client.query(params)
      if (result.stale || version !== queryVersion) return
      set((s) => {
        const deepLink = s.pendingExplain !== null ? result.response.hits[s.pendingExplain - 1] : undefined
        return {
          response: result.response,
          page: result.response.page,
          errorMessage: null,
          timing: { engineMs: result.response.processingTimeMS, roundTripMs: result.roundTripMs, tick: s.timing.tick + 1 },
          activeHit: deepLink ? s.pendingExplain! - 1 : -1,
          explainedHit: deepLink ? deepLink.objectID : null,
          pendingExplain: null,
        }
      })
      pushUrl()
      if (!get().playground.open) get().syncPlaygroundBody()
    } catch (error) {
      if (version === queryVersion) set({ errorMessage: error instanceof Error ? error.message : String(error) })
    }
  }

  return {
    query: '',
    refinements: emptyRefinements(),
    page: 0,

    status: 'booting',
    progress: null,
    ready: null,
    errorMessage: null,

    response: null,
    timing: { engineMs: 0, roundTripMs: 0, tick: 0 },
    activeHit: -1,
    explainedHit: null,
    pendingExplain: null,

    playground: {
      open: false,
      body: playgroundBodyFor({ query: '', hitsPerPage: HITS_PER_PAGE, page: 0 }),
      error: null,
      response: null,
      timing: null,
    },

    boot() {
      if (client) return
      get().hydrateFromUrl()
      client = new SearchClient(createSearchWorker(), {
        progress: (progress) => set({ status: 'loading', progress }),
        ready: (ready) => {
          set({ status: 'ready', ready, progress: null })
          void runQuery()
        },
        error: (message) => set({ status: 'error', errorMessage: message }),
      })
      set({ status: 'loading' })
      client.init(DATASET_URL)
      window.addEventListener('popstate', () => {
        get().hydrateFromUrl()
        void runQuery()
      })
    },

    hydrateFromUrl() {
      if (typeof window === 'undefined') return
      const state = parseSearchParams(window.location.search)
      set({ query: state.query, refinements: state.refinements, page: state.page, pendingExplain: state.explain })
    },

    setQuery(query) {
      set({ query, page: 0 })
      void runQuery()
    },

    toggleFacet(facet, value) {
      set((s) => ({ refinements: toggleRefinement(s.refinements, facet, value), page: 0 }))
      void runQuery()
    },

    clearRefinements() {
      set({ refinements: emptyRefinements(), page: 0 })
      void runQuery()
    },

    setPage(page) {
      set({ page: Math.max(0, page) })
      void runQuery()
    },

    applySuggestion(query) {
      set({ query, page: 0, refinements: emptyRefinements() })
      void runQuery()
    },

    setActiveHit(index) {
      set({ activeHit: index })
    },

    moveActiveHit(delta) {
      const hits = get().response?.hits ?? []
      if (hits.length === 0) return
      const current = get().activeHit
      const next = current < 0 ? (delta > 0 ? 0 : hits.length - 1) : (current + delta + hits.length) % hits.length
      set({ activeHit: next })
    },

    setExplainedHit(id) {
      set({ explainedHit: id })
    },

    setPlaygroundOpen(open) {
      set((s) => ({ playground: { ...s.playground, open } }))
      if (open) get().syncPlaygroundBody()
    },

    setPlaygroundBody(body) {
      playgroundVersion++
      let error: string | null = null
      try {
        parseQueryBody(body)
      } catch (err) {
        error = err instanceof Error ? err.message : 'invalid JSON'
      }
      set((s) => ({ playground: { ...s.playground, body, error } }))
    },

    syncPlaygroundBody() {
      playgroundVersion++
      const params = currentParams()
      set((s) => ({
        playground: { ...s.playground, body: playgroundBodyFor(params), error: null, response: s.response, timing: s.timing },
      }))
    },

    async runPlayground() {
      const version = ++playgroundVersion
      const { playground } = get()
      let params: QueryParams
      try {
        params = parseQueryBody(playground.body)
      } catch (err) {
        set((s) => ({ playground: { ...s.playground, error: err instanceof Error ? err.message : 'invalid JSON' } }))
        return
      }
      if (!client || get().status !== 'ready') return
      try {
        const result = await client.query(params, 'playground')
        if (result.stale || version !== playgroundVersion) return
        set((s) => ({
          playground: {
            ...s.playground,
            error: null,
            response: result.response,
            timing: { engineMs: result.response.processingTimeMS, roundTripMs: result.roundTripMs, tick: 0 },
          },
        }))
      } catch (error) {
        if (version === playgroundVersion) {
          set((s) => ({ playground: { ...s.playground, error: error instanceof Error ? error.message : String(error) } }))
        }
      }
    },
  }
})
