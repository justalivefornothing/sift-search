/**
 * Fixed-size bitset backed by a Uint32Array. Used for result sets and facet
 * value membership so that filtering and facet counting are word-parallel
 * AND/OR + popcount operations.
 */
export class Bitset {
  readonly size: number
  readonly words: Uint32Array

  constructor(size: number, words?: Uint32Array) {
    this.size = size
    this.words = words ?? new Uint32Array((size + 31) >>> 5)
  }

  static full(size: number): Bitset {
    const b = new Bitset(size)
    b.words.fill(0xffffffff)
    const rem = size & 31
    if (rem !== 0) b.words[b.words.length - 1] = (1 << rem) - 1 >>> 0
    return b
  }

  static fromIndices(size: number, indices: Iterable<number>): Bitset {
    const b = new Bitset(size)
    for (const i of indices) b.set(i)
    return b
  }

  set(i: number): void {
    this.words[i >>> 5] |= 1 << (i & 31)
  }

  clear(i: number): void {
    this.words[i >>> 5] &= ~(1 << (i & 31))
  }

  has(i: number): boolean {
    return (this.words[i >>> 5] & (1 << (i & 31))) !== 0
  }

  clone(): Bitset {
    return new Bitset(this.size, this.words.slice())
  }

  reset(): void {
    this.words.fill(0)
  }

  and(other: Bitset): Bitset {
    const out = new Bitset(this.size)
    const a = this.words
    const b = other.words
    const o = out.words
    for (let i = 0; i < a.length; i++) o[i] = a[i] & b[i]
    return out
  }

  andInPlace(other: Bitset): this {
    const a = this.words
    const b = other.words
    for (let i = 0; i < a.length; i++) a[i] &= b[i]
    return this
  }

  or(other: Bitset): Bitset {
    const out = new Bitset(this.size)
    const a = this.words
    const b = other.words
    const o = out.words
    for (let i = 0; i < a.length; i++) o[i] = a[i] | b[i]
    return out
  }

  orInPlace(other: Bitset): this {
    const a = this.words
    const b = other.words
    for (let i = 0; i < a.length; i++) a[i] |= b[i]
    return this
  }

  /** popcount of (this AND other) without allocating */
  andCount(other: Bitset): number {
    const a = this.words
    const b = other.words
    let total = 0
    for (let i = 0; i < a.length; i++) total += popcount32(a[i] & b[i])
    return total
  }

  count(): number {
    const a = this.words
    let total = 0
    for (let i = 0; i < a.length; i++) total += popcount32(a[i])
    return total
  }

  isEmpty(): boolean {
    const a = this.words
    for (let i = 0; i < a.length; i++) if (a[i] !== 0) return false
    return true
  }

  forEach(fn: (index: number) => void): void {
    const a = this.words
    for (let w = 0; w < a.length; w++) {
      let bits = a[w]
      while (bits !== 0) {
        const t = bits & -bits
        const bit = 31 - Math.clz32(t)
        fn((w << 5) + bit)
        bits ^= t
      }
    }
  }

  toArray(): number[] {
    const out: number[] = []
    this.forEach((i) => out.push(i))
    return out
  }
}

export function popcount32(v: number): number {
  v = v - ((v >>> 1) & 0x55555555)
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333)
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}
