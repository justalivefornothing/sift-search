/**
 * Scorer: walks the postings of every planned candidate term once and
 * accumulates, per document, everything the ranking criteria need:
 *
 *  - which query words matched (bit mask) and with how many typos (min per word)
 *  - whether the word matched exactly (bit mask)
 *  - the best attribute hit
 *  - a linked chain of (word, attribute, term, positions) entries, used to
 *    compute proximity lazily and to know which terms to highlight
 *
 * All scratch state is typed arrays sized once per index and reused across
 * queries, so a query allocates almost nothing.
 */
import { ATTR_BITS, ATTR_MASK, type InvertedIndex } from './inverted-index.ts'
import { Bitset } from './bitset.ts'
import { MAX_QUERY_WORDS, type QueryPlan } from './query-planner.ts'
import { popcount32 } from './bitset.ts'
import { packScoreParts } from './ranker.ts'
import type { Criteria, MatchedTerm } from './types.ts'

/** proximity cost for words that never share an attribute (and the per-pair cap) */
export const PROXIMITY_CAP = 8
const NO_ATTR = 255
const NO_TYPO = 255

export interface DocMatch {
  /** normalised terms that matched, grouped by query word index */
  termsByWord: Set<string>[]
  matchedTerms: MatchedTerm[]
}

export class Scorer {
  private readonly index: InvertedIndex
  private readonly docCount: number

  private readonly wordMask: Uint32Array
  private readonly exactMask: Uint32Array
  private readonly typoByWord: Uint8Array
  private readonly attrBest: Uint8Array
  private readonly head: Int32Array

  /** docs touched by the current query, in first-seen order */
  readonly touched: Int32Array
  touchedCount = 0
  /** bitset of docs matching at least one word */
  readonly matchBits: Bitset

  // growable entry chain
  private eNext = new Int32Array(1 << 14)
  private eWord = new Uint8Array(1 << 14)
  private eAttr = new Uint8Array(1 << 14)
  private eTypos = new Uint8Array(1 << 14)
  private eExact = new Uint8Array(1 << 14)
  private eTerm = new Int32Array(1 << 14)
  private eK = new Int32Array(1 << 14)
  private entryCount = 0

  private plan: QueryPlan = { words: [] }

  constructor(index: InvertedIndex) {
    this.index = index
    this.docCount = index.docCount
    this.wordMask = new Uint32Array(this.docCount)
    this.exactMask = new Uint32Array(this.docCount)
    this.typoByWord = new Uint8Array(this.docCount * MAX_QUERY_WORDS)
    this.attrBest = new Uint8Array(this.docCount)
    this.head = new Int32Array(this.docCount)
    this.touched = new Int32Array(this.docCount)
    this.matchBits = new Bitset(this.docCount)
  }

  /** Scan postings for every candidate in the plan. */
  run(plan: QueryPlan): void {
    this.plan = plan
    this.wordMask.fill(0)
    this.exactMask.fill(0)
    this.typoByWord.fill(NO_TYPO)
    this.attrBest.fill(NO_ATTR)
    this.head.fill(-1)
    this.matchBits.reset()
    this.touchedCount = 0
    this.entryCount = 0

    const postings = this.index.postings
    for (let wi = 0; wi < plan.words.length; wi++) {
      const bit = 1 << wi
      for (const cand of plan.words[wi].candidates) {
        const list = postings[cand.termId]
        if (!list) continue
        const entries = list.entries
        for (let k = 0; k < entries.length; k++) {
          const key = entries[k]
          const doc = key >>> ATTR_BITS
          const attr = key & ATTR_MASK
          if (this.wordMask[doc] === 0) {
            this.touched[this.touchedCount++] = doc
            this.matchBits.set(doc)
          }
          this.wordMask[doc] |= bit
          if (cand.exact) this.exactMask[doc] |= bit
          const slot = doc * MAX_QUERY_WORDS + wi
          if (cand.typos < this.typoByWord[slot]) this.typoByWord[slot] = cand.typos
          if (attr < this.attrBest[doc]) this.attrBest[doc] = attr
          this.pushEntry(doc, wi, attr, cand.typos, cand.exact, cand.termId, k)
        }
      }
    }
  }

  private pushEntry(doc: number, word: number, attr: number, typos: number, exact: boolean, termId: number, k: number): void {
    if (this.entryCount === this.eNext.length) this.grow()
    const e = this.entryCount++
    this.eNext[e] = this.head[doc]
    this.head[doc] = e
    this.eWord[e] = word
    this.eAttr[e] = attr
    this.eTypos[e] = typos
    this.eExact[e] = exact ? 1 : 0
    this.eTerm[e] = termId
    this.eK[e] = k
  }

  private grow(): void {
    const n = this.eNext.length * 2
    const copy = <T extends Int32Array | Uint8Array>(old: T, make: (n: number) => T): T => {
      const next = make(n)
      next.set(old)
      return next
    }
    this.eNext = copy(this.eNext, (n) => new Int32Array(n))
    this.eWord = copy(this.eWord, (n) => new Uint8Array(n))
    this.eAttr = copy(this.eAttr, (n) => new Uint8Array(n))
    this.eTypos = copy(this.eTypos, (n) => new Uint8Array(n))
    this.eExact = copy(this.eExact, (n) => new Uint8Array(n))
    this.eTerm = copy(this.eTerm, (n) => new Int32Array(n))
    this.eK = copy(this.eK, (n) => new Int32Array(n))
  }

  /** Packed tiered score for a touched doc (same vector as `criteria`, no allocation). */
  score(doc: number, popScore: number): number {
    const mask = this.wordMask[doc]
    const words = popcount32(mask)
    let typos = 0
    const base = doc * MAX_QUERY_WORDS
    for (let wi = 0; wi < this.plan.words.length; wi++) {
      if (mask & (1 << wi)) typos += this.typoByWord[base + wi]
    }
    const proximity = words >= 2 ? this.proximity(doc, mask) : 0
    const attribute = this.attrBest[doc] === NO_ATTR ? 0 : this.attrBest[doc]
    return packScoreParts(typos, words, proximity, attribute, popcount32(this.exactMask[doc]), popScore)
  }

  /** Ranking-criteria vector for a touched doc (popularity is filled in by the caller). */
  criteria(doc: number, popularity: number): Criteria {
    const mask = this.wordMask[doc]
    const words = popcount32(mask)
    let typos = 0
    const base = doc * MAX_QUERY_WORDS
    for (let wi = 0; wi < this.plan.words.length; wi++) {
      if (mask & (1 << wi)) typos += this.typoByWord[base + wi]
    }
    return {
      typos,
      words,
      proximity: words >= 2 ? this.proximity(doc, mask) : 0,
      attribute: this.attrBest[doc] === NO_ATTR ? 0 : this.attrBest[doc],
      exactness: popcount32(this.exactMask[doc]),
      popularity,
    }
  }

  /**
   * Sum over consecutive matched query words of the smallest distance between
   * their positions inside one attribute (reverse order costs one extra, each
   * pair is capped at PROXIMITY_CAP; words that never share an attribute cost the cap).
   */
  private proximity(doc: number, mask: number): number {
    let total = 0
    let prev = -1
    for (let wi = 0; wi < this.plan.words.length; wi++) {
      if ((mask & (1 << wi)) === 0) continue
      if (prev >= 0) total += this.pairDistance(doc, prev, wi)
      prev = wi
    }
    return total
  }

  private pairDistance(doc: number, w1: number, w2: number): number {
    let best = PROXIMITY_CAP
    const postings = this.index.postings
    for (let e1 = this.head[doc]; e1 >= 0; e1 = this.eNext[e1]) {
      if (this.eWord[e1] !== w1) continue
      const attr = this.eAttr[e1]
      const l1 = postings[this.eTerm[e1]]
      const k1 = this.eK[e1]
      const p1 = l1.positions
      const s1 = l1.offsets[k1]
      const t1 = l1.offsets[k1 + 1]
      for (let e2 = this.head[doc]; e2 >= 0; e2 = this.eNext[e2]) {
        if (this.eWord[e2] !== w2 || this.eAttr[e2] !== attr) continue
        const l2 = postings[this.eTerm[e2]]
        const k2 = this.eK[e2]
        const p2 = l2.positions
        const s2 = l2.offsets[k2]
        const t2 = l2.offsets[k2 + 1]
        for (let i = s1; i < t1; i++) {
          const a = p1[i]
          for (let j = s2; j < t2; j++) {
            const b = p2[j]
            const d = b > a ? b - a : a - b + 1
            if (d < best) {
              best = d
              if (best === 1) return 1
            }
          }
        }
      }
    }
    return best
  }

  /** Terms that matched a doc, for highlighting and the explainer. */
  matches(doc: number): DocMatch {
    const termsByWord: Set<string>[] = this.plan.words.map(() => new Set<string>())
    const matched: MatchedTerm[] = []
    const seen = new Set<number>()
    for (let e = this.head[doc]; e >= 0; e = this.eNext[e]) {
      const wi = this.eWord[e]
      const termId = this.eTerm[e]
      const term = this.index.termById(termId)
      termsByWord[wi].add(term)
      const key = wi * 1048576 + termId
      if (seen.has(key)) continue
      seen.add(key)
      matched.push({ word: this.plan.words[wi].word, term, typos: this.eTypos[e], exact: this.eExact[e] === 1 })
    }
    matched.sort((a, b) => a.word.localeCompare(b.word) || a.typos - b.typos || a.term.localeCompare(b.term))
    return { termsByWord, matchedTerms: matched }
  }
}
