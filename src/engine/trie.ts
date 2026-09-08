/**
 * Compressed (radix) trie over index terms.
 *
 * Besides exact lookup and prefix enumeration it supports a bounded
 * Damerau–Levenshtein traversal: a dynamic-programming row is carried down the
 * trie one character at a time (edge labels are walked char by char), and a
 * whole subtree is abandoned as soon as the row minimum exceeds the typo
 * budget. In "prefix mode" a term matches if ANY of its prefixes is within the
 * budget of the query, which is what search-as-you-type needs for the last
 * word being typed.
 */

export interface FuzzyMatch {
  termId: number
  term: string
  distance: number
}

class TrieNode {
  label: string
  termId = -1
  children: Map<string, TrieNode> | null = null

  constructor(label: string) {
    this.label = label
  }
}

function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length)
  let i = 0
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++
  return i
}

export class Trie {
  private root = new TrieNode('')
  private terms: string[] = []
  private nodes = 1

  /** number of terms stored */
  get size(): number {
    return this.terms.length
  }

  /** number of trie nodes (compressed) */
  get nodeCount(): number {
    return this.nodes
  }

  termById(id: number): string {
    return this.terms[id]
  }

  /** Insert a term; returns its id (existing id if already present). */
  insert(term: string): number {
    let node = this.root
    let rest = term
    for (;;) {
      if (rest.length === 0) {
        if (node.termId < 0) {
          node.termId = this.terms.length
          this.terms.push(term)
        }
        return node.termId
      }
      const first = rest[0]
      const child = node.children?.get(first)
      if (!child) {
        const leaf = new TrieNode(rest)
        leaf.termId = this.terms.length
        this.terms.push(term)
        if (!node.children) node.children = new Map()
        node.children.set(first, leaf)
        this.nodes++
        return leaf.termId
      }
      const k = commonPrefixLength(child.label, rest)
      if (k === child.label.length) {
        node = child
        rest = rest.slice(k)
        continue
      }
      // split the child at k
      const mid = new TrieNode(child.label.slice(0, k))
      child.label = child.label.slice(k)
      mid.children = new Map([[child.label[0], child]])
      node.children!.set(first, mid)
      this.nodes++
      node = mid
      rest = rest.slice(k)
    }
  }

  /** Exact lookup; -1 when absent. */
  get(term: string): number {
    const node = this.find(term)
    return node && node.termId >= 0 ? node.termId : -1
  }

  has(term: string): boolean {
    return this.get(term) >= 0
  }

  private find(str: string): TrieNode | null {
    let node = this.root
    let rest = str
    while (rest.length > 0) {
      const child = node.children?.get(rest[0])
      if (!child || !rest.startsWith(child.label)) return null
      rest = rest.slice(child.label.length)
      node = child
    }
    return node
  }

  /** All term ids whose term starts with `prefix` (depth-first, lexicographic-ish order). */
  prefix(prefix: string): number[] {
    const out: number[] = []
    let node = this.root
    let rest = prefix
    while (rest.length > 0) {
      const child = node.children?.get(rest[0])
      if (!child) return out
      if (rest.length < child.label.length) {
        if (!child.label.startsWith(rest)) return out
        rest = ''
        node = child
        break
      }
      if (!rest.startsWith(child.label)) return out
      rest = rest.slice(child.label.length)
      node = child
    }
    this.collectIds(node, out)
    return out
  }

  private collectIds(node: TrieNode, out: number[]): void {
    if (node.termId >= 0) out.push(node.termId)
    if (node.children) for (const c of node.children.values()) this.collectIds(c, out)
  }

  /**
   * Bounded fuzzy search.
   * - exact mode: terms whose full form is within `maxDistance` of `query`
   * - prefix mode: terms for which SOME prefix is within `maxDistance` of `query`
   *   (the reported distance is the best over all prefixes)
   */
  fuzzy(query: string, maxDistance: number, prefixMode: boolean): FuzzyMatch[] {
    const out: FuzzyMatch[] = []
    if (maxDistance <= 0 && !prefixMode) {
      const id = this.get(query)
      if (id >= 0) out.push({ termId: id, term: query, distance: 0 })
      return out
    }
    if (maxDistance <= 0 && prefixMode) {
      for (const id of this.prefix(query)) out.push({ termId: id, term: this.terms[id], distance: 0 })
      return out
    }
    const q = query
    const n = q.length
    const ctx: FuzzyCtx = {
      q,
      n,
      max: maxDistance,
      prefixMode,
      rows: [],
      out,
      terms: this.terms,
    }
    const row0 = new Int32Array(n + 1)
    for (let i = 0; i <= n; i++) row0[i] = i
    ctx.rows[0] = row0
    fuzzyWalk(ctx, this.root, 0, -1, prefixMode ? n : Number.POSITIVE_INFINITY)
    return out
  }
}

interface FuzzyCtx {
  q: string
  n: number
  max: number
  prefixMode: boolean
  rows: Int32Array[]
  out: FuzzyMatch[]
  terms: string[]
}

function collectAll(ctx: FuzzyCtx, node: TrieNode, distance: number): void {
  if (node.termId >= 0) ctx.out.push({ termId: node.termId, term: ctx.terms[node.termId], distance })
  if (node.children) for (const c of node.children.values()) collectAll(ctx, c, distance)
}

/**
 * Depth-first walk. `depth` is the number of path characters consumed so far;
 * ctx.rows[depth] holds the DP row for that path. `prevCode` is the char code
 * at path position depth-1 (for transpositions). `bestPrefix` is the best
 * distance between the query and any prefix of the path so far (prefix mode).
 */
function fuzzyWalk(ctx: FuzzyCtx, node: TrieNode, depth: number, prevCode: number, bestPrefix: number): void {
  if (!node.children) return
  const { q, n, max } = ctx
  for (const child of node.children.values()) {
    const label = child.label
    let d = depth
    let prev = prevCode
    let best = bestPrefix
    let pruned = false
    let shortcut = false

    for (let k = 0; k < label.length; k++) {
      const code = label.charCodeAt(k)
      const prevRow = ctx.rows[d]
      let row = ctx.rows[d + 1]
      if (!row) {
        row = new Int32Array(n + 1)
        ctx.rows[d + 1] = row
      }
      const prev2Row = d >= 1 ? ctx.rows[d - 1] : null
      row[0] = d + 1
      let rowMin = row[0]
      for (let i = 1; i <= n; i++) {
        const qi = q.charCodeAt(i - 1)
        let v = prevRow[i - 1] + (qi === code ? 0 : 1)
        const del = prevRow[i] + 1
        if (del < v) v = del
        const ins = row[i - 1] + 1
        if (ins < v) v = ins
        if (prev2Row && i > 1 && prev >= 0 && qi === prev && q.charCodeAt(i - 2) === code) {
          const tr = prev2Row[i - 2] + 1
          if (tr < v) v = tr
        }
        row[i] = v
        if (v < rowMin) rowMin = v
      }
      d++
      prev = code
      if (ctx.prefixMode) {
        if (row[n] < best) best = row[n]
        // once the path is longer than the query by more than the budget, no
        // deeper prefix can improve → collect the subtree wholesale
        if (best === 0 || d - n >= max) {
          if (best <= max) {
            shortcut = true
          } else {
            pruned = true
          }
          break
        }
        if (rowMin > max) {
          // no full-length alignment can succeed, but a prefix may already have
          if (best <= max) shortcut = true
          else pruned = true
          break
        }
      } else if (rowMin > max) {
        pruned = true
        break
      }
    }

    if (pruned) continue
    if (shortcut) {
      collectAll(ctx, child, best)
      continue
    }

    const row = ctx.rows[d]
    if (child.termId >= 0) {
      const dist = ctx.prefixMode ? best : row[n]
      if (dist <= max) ctx.out.push({ termId: child.termId, term: ctx.terms[child.termId], distance: dist })
    }
    fuzzyWalk(ctx, child, d, prev, best)
  }
}
