/**
 * Faceting over bitsets.
 *
 * Each facet value owns a Bitset of the documents that carry it. Given the
 * text-match result set R and the active refinements, the filtered result is
 *   R ∧ ⋀_facets (⋁_selected values)          (OR within a facet, AND across)
 * and the live count shown for a value V of facet F is
 *   |R ∧ ⋀_{G≠F} filter(G) ∧ bits(V)|
 * i.e. the count a user would get by adding V to their current selection,
 * which is the "disjunctive facet" behaviour instant-search UIs expect.
 */
import { Bitset } from './bitset.ts'
import type { FacetCounts, SearchRecord } from './types.ts'

export interface FacetDefinition {
  name: string
  values(record: SearchRecord): string[]
}

export function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}s`
}

export const RATING_BUCKETS = ['9+', '8–9', '7–8', '6–7', '<6'] as const

export function ratingBucket(rating: number): string {
  if (rating >= 9) return '9+'
  if (rating >= 8) return '8–9'
  if (rating >= 7) return '7–8'
  if (rating >= 6) return '6–7'
  return '<6'
}

export const DEFAULT_FACETS: FacetDefinition[] = [
  { name: 'genre', values: (r) => r.genres },
  { name: 'decade', values: (r) => [decadeOf(r.year)] },
  { name: 'rating', values: (r) => [ratingBucket(r.rating)] },
]

export type FacetFilters = Record<string, string[]>

export interface FacetResult {
  filtered: Bitset
  counts: FacetCounts
}

export class FacetIndex {
  private readonly values = new Map<string, Map<string, Bitset>>()
  readonly docCount: number

  constructor(records: SearchRecord[], definitions: FacetDefinition[] = DEFAULT_FACETS) {
    this.docCount = records.length
    for (const def of definitions) this.values.set(def.name, new Map())
    for (let doc = 0; doc < records.length; doc++) {
      for (const def of definitions) {
        const map = this.values.get(def.name)!
        for (const v of def.values(records[doc])) {
          let bits = map.get(v)
          if (!bits) {
            bits = new Bitset(records.length)
            map.set(v, bits)
          }
          bits.set(doc)
        }
      }
    }
  }

  facetNames(): string[] {
    return [...this.values.keys()]
  }

  /** typed-array footprint of all value bitsets */
  approxBytes(): number {
    let bytes = 0
    for (const map of this.values.values()) for (const bits of map.values()) bytes += bits.words.byteLength
    return bytes
  }

  valuesOf(facet: string): string[] {
    return [...(this.values.get(facet)?.keys() ?? [])]
  }

  /** Bitset for the OR of the selected values of one facet; null when nothing selected (no restriction). */
  private filterBits(facet: string, selected: string[] | undefined): Bitset | null {
    if (!selected || selected.length === 0) return null
    const map = this.values.get(facet)
    const out = new Bitset(this.docCount)
    if (!map) return out // unknown facet with a selection matches nothing
    for (const v of selected) {
      const bits = map.get(v)
      if (bits) out.orInPlace(bits)
    }
    return out
  }

  /**
   * Apply refinements to a base result set and compute live counts for the
   * requested facets (all facets when `wanted` is omitted).
   */
  apply(base: Bitset, filters: FacetFilters, wanted?: string[]): FacetResult {
    const names = wanted ?? this.facetNames()
    const perFacet = new Map<string, Bitset | null>()
    for (const name of Object.keys(filters)) perFacet.set(name, this.filterBits(name, filters[name]))

    // fully filtered set
    const filtered = base.clone()
    for (const bits of perFacet.values()) if (bits) filtered.andInPlace(bits)

    const counts: FacetCounts = {}
    for (const name of names) {
      const map = this.values.get(name)
      if (!map) continue
      // base restricted by every OTHER facet's selection
      let scope = base
      let cloned = false
      for (const [other, bits] of perFacet) {
        if (other === name || !bits) continue
        if (!cloned) {
          scope = scope.clone()
          cloned = true
        }
        scope.andInPlace(bits)
      }
      const table: Record<string, number> = {}
      for (const [value, bits] of map) {
        const c = scope.andCount(bits)
        if (c > 0) table[value] = c
      }
      // keep selected-but-now-zero values visible so users can un-select them
      for (const v of filters[name] ?? []) if (!(v in table) && map.has(v)) table[v] = 0
      counts[name] = table
    }
    return { filtered, counts }
  }
}

/** Parse Algolia-style facetFilters ([["genre:Action","genre:Drama"],["decade:1990s"]]) into a map. */
export function parseFacetFilters(facetFilters: string[][] | undefined): FacetFilters {
  const out: FacetFilters = {}
  if (!facetFilters) return out
  for (const group of facetFilters) {
    for (const item of group) {
      const idx = item.indexOf(':')
      if (idx <= 0) continue
      const facet = item.slice(0, idx)
      const value = item.slice(idx + 1)
      ;(out[facet] ??= []).push(value)
    }
  }
  return out
}
