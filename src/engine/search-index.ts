/**
 * SearchIndex: the public facade of the engine.
 *
 *   records ─▶ tokenizer ─▶ inverted index (+ radix trie) ─▶ facet bitsets
 *
 *   query ─▶ planner (exact / prefix / typo candidates)
 *         ─▶ scorer (one postings scan → criteria per doc)
 *         ─▶ facet filter (bitset AND / OR) + live counts
 *         ─▶ top-K by packed tiered score
 *         ─▶ hits with highlights, snippets and ranking explanation
 */
import { Bitset } from './bitset.ts'
import { DEFAULT_FACETS, FacetIndex, parseFacetFilters, type FacetDefinition } from './facets.ts'
import { highlight, snippet } from './highlight.ts'
import { InvertedIndex } from './inverted-index.ts'
import { boundedInteger } from './params.ts'
import { describePlan, planQuery, type QueryPlan } from './query-planner.ts'
import { findTieBreak } from './ranker.ts'
import { Scorer } from './scorer.ts'
import { suggestQueries } from './suggest.ts'
import { TopK } from './topk.ts'
import {
  ATTRIBUTES,
  type Criteria,
  type Hit,
  type IndexStats,
  type QueryParams,
  type QueryResponse,
  type SearchRecord,
} from './types.ts'

export interface SearchIndexOptions {
  facets?: FacetDefinition[]
  indexName?: string
}

export const DEFAULT_HITS_PER_PAGE = 20
export const MAX_HITS_PER_PAGE = 100

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export class SearchIndex {
  readonly records: readonly SearchRecord[]
  readonly inverted: InvertedIndex
  readonly facets: FacetIndex
  readonly stats: IndexStats
  readonly name: string
  private readonly scorer: Scorer
  private readonly popScore: Uint32Array
  private readonly everything: Bitset

  constructor(records: readonly SearchRecord[], options: SearchIndexOptions = {}) {
    const t0 = now()
    this.records = records
    this.name = options.indexName ?? 'records'
    this.inverted = new InvertedIndex(records as SearchRecord[])
    this.facets = new FacetIndex(records as SearchRecord[], options.facets ?? DEFAULT_FACETS)
    this.scorer = new Scorer(this.inverted)
    this.everything = Bitset.full(records.length)

    // custom ranking: popularity desc, id asc as a stable final tie-break
    const order = records.map((_, i) => i)
    order.sort((a, b) => records[b].popularity - records[a].popularity || a - b)
    this.popScore = new Uint32Array(records.length)
    for (let rank = 0; rank < order.length; rank++) this.popScore[order[rank]] = records.length - 1 - rank

    this.stats = {
      records: records.length,
      terms: this.inverted.termCount,
      postings: this.inverted.postingCount,
      positions: this.inverted.positionCount,
      trieNodes: this.inverted.trie.nodeCount,
      indexTimeMs: Math.round((now() - t0) * 100) / 100,
      approxBytes: this.inverted.approxBytes() + this.facets.approxBytes() + this.popScore.byteLength,
    }
  }

  /** Number of records matching the text of `query` (no facets, no ranking). */
  countHits(query: string): number {
    const plan = planQuery(this.inverted, query, { typoTolerance: true, prefixLast: true })
    if (plan.words.length === 0) return this.records.length
    this.scorer.run(plan)
    return this.scorer.touchedCount
  }

  search(params: QueryParams): QueryResponse {
    const t0 = now()
    const query = params.query ?? ''
    const hitsPerPage = boundedInteger(params.hitsPerPage, DEFAULT_HITS_PER_PAGE, 1, MAX_HITS_PER_PAGE)
    const typoTolerance = params.typoTolerance ?? true

    const plan = planQuery(this.inverted, query, { typoTolerance, prefixLast: true })
    const hasWords = plan.words.length > 0
    if (hasWords) this.scorer.run(plan)
    const base = hasWords ? this.scorer.matchBits : this.everything

    const filters = parseFacetFilters(params.facetFilters)
    const filtersActive = Object.values(filters).some((v) => v.length > 0)
    const { filtered, counts } = this.facets.apply(base, filters, params.facets)
    const nbHits = filtered.count()
    const nbPages = Math.ceil(nbHits / hitsPerPage)
    // A URL can contain an arbitrarily large page. Clamp to a real page before
    // multiplying, then cap the heap at the number of candidates it can retain.
    const page = boundedInteger(params.page, 0, 0, Math.max(0, nbPages - 1))

    // top-K selection over the filtered candidates
    const wanted = Math.min(nbHits, (page + 1) * hitsPerPage)
    const top = new TopK(wanted)
    if (hasWords) {
      const touched = this.scorer.touched
      for (let i = 0; i < this.scorer.touchedCount; i++) {
        const doc = touched[i]
        if (!filtered.has(doc)) continue
        top.push(this.scorer.score(doc, this.popScore[doc]), doc)
      }
    } else {
      filtered.forEach((doc) => top.push(this.popScore[doc], doc))
    }
    const ranked = top.drain()
    const start = page * hitsPerPage
    const pageDocs = ranked.slice(start, start + hitsPerPage).map((r) => r.item)
    const previousDoc = start > 0 && ranked.length > start ? ranked[start - 1].item : -1

    const queryWords = plan.words.map((w) => w.word)
    const hits: Hit[] = []
    let previous: Criteria | null = previousDoc >= 0 ? this.criteriaFor(previousDoc, hasWords) : null
    for (const doc of pageDocs) {
      const criteria = this.criteriaFor(doc, hasWords)
      hits.push(this.buildHit(doc, plan, queryWords, criteria, previous ? findTieBreak(previous, criteria) : null,
        boundedInteger(params.snippetLength, 24, 1, Number.MAX_SAFE_INTEGER)))
      previous = criteria
    }

    let suggestions: string[] = []
    if (nbHits === 0 && hasWords && !filtersActive) {
      suggestions = suggestQueries(this.inverted, queryWords, (q) => this.countHits(q))
    }

    const processingTimeMS = Math.round((now() - t0) * 100) / 100
    return {
      hits,
      nbHits,
      page,
      nbPages,
      hitsPerPage,
      processingTimeMS,
      query,
      params: serializeParams(params, hitsPerPage, page),
      index: this.name,
      exhaustiveNbHits: true,
      facets: counts,
      parsedQuery: describePlan(plan),
      suggestions,
    }
  }

  private criteriaFor(doc: number, hasWords: boolean): Criteria {
    const popularity = this.records[doc].popularity
    if (!hasWords) return { typos: 0, words: 0, proximity: 0, attribute: 0, exactness: 0, popularity }
    return this.scorer.criteria(doc, popularity)
  }

  private buildHit(
    doc: number,
    plan: QueryPlan,
    queryWords: string[],
    criteria: Criteria,
    tieBreak: ReturnType<typeof findTieBreak>,
    snippetLength: number | undefined,
  ): Hit {
    const record = this.records[doc]
    const hasWords = plan.words.length > 0
    const match = hasWords ? this.scorer.matches(doc) : { termsByWord: [], matchedTerms: [] }
    const terms = match.termsByWord
    return {
      ...record,
      objectID: record.id,
      _highlightResult: {
        title: highlight(record.title, terms, queryWords),
        description: highlight(record.description, terms, queryWords),
        genres: record.genres.map((g) => highlight(g, terms, queryWords)),
      },
      _snippetResult: {
        description: snippet(record.description, terms, queryWords, snippetLength ?? 24),
      },
      _rankingInfo: {
        ...criteria,
        attributeName: hasWords ? ATTRIBUTES[criteria.attribute] : 'none',
        tieBreak,
        matchedTerms: match.matchedTerms,
      },
    }
  }
}

function serializeParams(params: QueryParams, hitsPerPage: number, page: number): string {
  const parts = [`query=${encodeURIComponent(params.query ?? '')}`, `hitsPerPage=${hitsPerPage}`, `page=${page}`]
  if (params.facetFilters && params.facetFilters.length > 0) {
    parts.push(`facetFilters=${encodeURIComponent(JSON.stringify(params.facetFilters))}`)
  }
  if (params.facets) parts.push(`facets=${encodeURIComponent(params.facets.join(','))}`)
  if (params.typoTolerance === false) parts.push('typoTolerance=false')
  return parts.join('&')
}
