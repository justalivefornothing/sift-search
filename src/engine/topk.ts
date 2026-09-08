/**
 * Bounded min-heap that keeps the K largest (score, payload) pairs seen.
 * O(n log K) to select a page of results out of n candidates instead of
 * sorting all of them.
 */
export class TopK {
  private readonly k: number
  private readonly scores: Float64Array
  private readonly items: Int32Array
  private size = 0

  constructor(k: number) {
    this.k = Math.max(1, k)
    this.scores = new Float64Array(this.k)
    this.items = new Int32Array(this.k)
  }

  get length(): number {
    return this.size
  }

  /** Smallest score currently retained (−∞ while not full). */
  threshold(): number {
    return this.size < this.k ? Number.NEGATIVE_INFINITY : this.scores[0]
  }

  push(score: number, item: number): void {
    if (this.size < this.k) {
      let i = this.size++
      this.scores[i] = score
      this.items[i] = item
      // sift up
      while (i > 0) {
        const p = (i - 1) >> 1
        if (this.scores[p] <= this.scores[i]) break
        this.swap(i, p)
        i = p
      }
      return
    }
    if (score <= this.scores[0]) return
    this.scores[0] = score
    this.items[0] = item
    this.siftDown(0)
  }

  private siftDown(i: number): void {
    const n = this.size
    for (;;) {
      const l = 2 * i + 1
      const r = l + 1
      let m = i
      if (l < n && this.scores[l] < this.scores[m]) m = l
      if (r < n && this.scores[r] < this.scores[m]) m = r
      if (m === i) return
      this.swap(i, m)
      i = m
    }
  }

  private swap(a: number, b: number): void {
    const s = this.scores[a]
    this.scores[a] = this.scores[b]
    this.scores[b] = s
    const it = this.items[a]
    this.items[a] = this.items[b]
    this.items[b] = it
  }

  /** Retained items, best score first. */
  drain(): { score: number; item: number }[] {
    const out: { score: number; item: number }[] = []
    for (let i = 0; i < this.size; i++) out.push({ score: this.scores[i], item: this.items[i] })
    out.sort((a, b) => b.score - a.score)
    return out
  }
}
