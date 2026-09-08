/**
 * Inverted index with per-attribute positional postings.
 *
 * Every term id owns one PostingList. Entries are packed 32-bit integers
 * (docId << 2 | attributeRank) sorted by doc then attribute; `offsets` slices
 * the flat `positions` array so a (doc, attribute) pair's token positions are
 * `positions.subarray(offsets[k], offsets[k + 1])`.
 *
 * Construction is a two-pass counting sort over a flat token stream (typed
 * arrays only), so indexing 10k records costs little more than tokenizing them.
 */
import { ATTRIBUTES, type SearchRecord } from './types.ts'
import { tokenize } from './tokenizer.ts'
import { Trie } from './trie.ts'

export const ATTR_BITS = 2
export const ATTR_MASK = (1 << ATTR_BITS) - 1

export interface PostingList {
  entries: Uint32Array
  offsets: Uint32Array
  positions: Uint16Array
}

/** gap between consecutive values of a multi-valued attribute so words from different values never look adjacent */
const MULTI_VALUE_GAP = 8

export function attributeText(record: SearchRecord, attr: number): string[] {
  switch (ATTRIBUTES[attr]) {
    case 'title':
      return [record.title]
    case 'genres':
      return record.genres
    case 'description':
      return [record.description]
    default:
      return []
  }
}

/** growable Int32 buffer */
class IntBuffer {
  data = new Int32Array(1 << 16)
  length = 0
  push(v: number): void {
    if (this.length === this.data.length) {
      const next = new Int32Array(this.data.length * 2)
      next.set(this.data)
      this.data = next
    }
    this.data[this.length++] = v
  }
}

export class InvertedIndex {
  readonly trie = new Trie()
  readonly postings: PostingList[] = []
  readonly docCount: number
  /** total number of (term, doc, attribute) entries */
  postingCount = 0
  /** total number of stored positions */
  positionCount = 0
  private readonly docFreqs: Uint32Array

  constructor(records: readonly SearchRecord[]) {
    this.docCount = records.length

    // ---- pass 1: flat token stream (term, key, position) in document order ----
    const termIds = new Map<string, number>()
    const tokTerm = new IntBuffer()
    const tokKey = new IntBuffer()
    const tokPos = new IntBuffer()

    for (let doc = 0; doc < records.length; doc++) {
      const record = records[doc]
      for (let attr = 0; attr < ATTRIBUTES.length; attr++) {
        const key = (doc << ATTR_BITS) | attr
        let base = 0
        for (const value of attributeText(record, attr)) {
          const tokens = tokenize(value)
          for (let p = 0; p < tokens.length; p++) {
            const text = tokens[p].text
            let termId = termIds.get(text)
            if (termId === undefined) {
              termId = this.trie.insert(text)
              termIds.set(text, termId)
            }
            tokTerm.push(termId)
            tokKey.push(key)
            tokPos.push(Math.min(base + p, 0xffff))
          }
          base += tokens.length + MULTI_VALUE_GAP
        }
      }
    }

    // ---- pass 2: counting sort tokens by term (stable → keys stay doc-ordered) ----
    const n = tokTerm.length
    const termCount = this.trie.size
    const counts = new Uint32Array(termCount + 1)
    for (let i = 0; i < n; i++) counts[tokTerm.data[i] + 1]++
    for (let t = 0; t < termCount; t++) counts[t + 1] += counts[t]
    const order = new Int32Array(n)
    const cursor = counts.slice(0, termCount)
    for (let i = 0; i < n; i++) order[cursor[tokTerm.data[i]]++] = i

    this.docFreqs = new Uint32Array(termCount)
    for (let t = 0; t < termCount; t++) {
      const from = counts[t]
      const to = counts[t + 1]
      // count distinct keys and distinct docs for this term
      let entryCount = 0
      let df = 0
      let lastKey = -1
      for (let i = from; i < to; i++) {
        const key = tokKey.data[order[i]]
        if (key !== lastKey) {
          entryCount++
          if (key >>> ATTR_BITS !== lastKey >>> ATTR_BITS) df++
          lastKey = key
        }
      }
      const entries = new Uint32Array(entryCount)
      const offsets = new Uint32Array(entryCount + 1)
      const positions = new Uint16Array(to - from)
      let e = -1
      lastKey = -1
      for (let i = from; i < to; i++) {
        const idx = order[i]
        const key = tokKey.data[idx]
        if (key !== lastKey) {
          e++
          entries[e] = key
          offsets[e] = i - from
          lastKey = key
        }
        positions[i - from] = tokPos.data[idx]
      }
      offsets[entryCount] = to - from
      this.postings[t] = { entries, offsets, positions }
      this.postingCount += entryCount
      this.positionCount += to - from
      this.docFreqs[t] = df
    }
  }

  get termCount(): number {
    return this.trie.size
  }

  termById(id: number): string {
    return this.trie.termById(id)
  }

  termId(term: string): number {
    return this.trie.get(term)
  }

  /** number of distinct documents containing the term */
  docFreq(termId: number): number {
    return this.docFreqs[termId] ?? 0
  }

  /** rough typed-array footprint */
  approxBytes(): number {
    let bytes = 0
    for (const p of this.postings) bytes += p.entries.byteLength + p.offsets.byteLength + p.positions.byteLength
    bytes += this.docFreqs.byteLength
    return bytes
  }
}
