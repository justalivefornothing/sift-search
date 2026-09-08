/**
 * Small deterministic PRNG (xoshiro128**) so the dataset is reproducible from a
 * seed without any dependency.
 */
export class Rng {
  private s0: number
  private s1: number
  private s2: number
  private s3: number

  constructor(seed: number) {
    // splitmix32 to expand the seed into four non-zero state words
    let x = seed >>> 0
    const next = (): number => {
      x = (x + 0x9e3779b9) >>> 0
      let z = x
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad)
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97)
      return (z ^ (z >>> 15)) >>> 0
    }
    this.s0 = next()
    this.s1 = next()
    this.s2 = next()
    this.s3 = next()
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1
  }

  /** uniform integer in [0, 2^32) */
  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9) >>> 0
    const t = this.s1 << 9
    this.s2 ^= this.s0
    this.s3 ^= this.s1
    this.s1 ^= this.s2
    this.s0 ^= this.s3
    this.s2 ^= t
    this.s3 = rotl(this.s3, 11)
    return result
  }

  /** uniform float in [0, 1) */
  next(): number {
    return this.nextU32() / 4294967296
  }

  /** uniform integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]
  }

  /** k distinct picks */
  sample<T>(items: readonly T[], k: number): T[] {
    const pool = items.slice()
    const out: T[] = []
    for (let i = 0; i < k && pool.length > 0; i++) {
      const idx = Math.floor(this.next() * pool.length)
      out.push(pool[idx])
      pool[idx] = pool[pool.length - 1]
      pool.pop()
    }
    return out
  }

  /** standard normal via Box–Muller */
  normal(mean = 0, sd = 1): number {
    let u = 0
    while (u === 0) u = this.next()
    const v = this.next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0
}
