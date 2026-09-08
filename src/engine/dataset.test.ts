import { describe, expect, it } from 'vitest'
import { generateDataset } from '../../scripts/dataset/generator.ts'
import { Rng } from '../../scripts/dataset/rng.ts'

describe('dataset generator', () => {
  it('is deterministic for a given seed', () => {
    const a = generateDataset(20260907, 600)
    const b = generateDataset(20260907, 600)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    const c = generateDataset(1, 600)
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a))
  })

  it('produces the requested number of well-formed, unique records', () => {
    const records = generateDataset(20260907, 10000)
    expect(records.length).toBeGreaterThanOrEqual(10000)
    expect(new Set(records.map((r) => r.title.toLowerCase())).size).toBe(records.length)
    expect(new Set(records.map((r) => r.id)).size).toBe(records.length)
    for (const r of records.slice(0, 500)) {
      expect(r.title.length).toBeGreaterThan(0)
      expect(r.description.length).toBeGreaterThan(20)
      expect(r.genres.length).toBeGreaterThanOrEqual(1)
      expect(r.year).toBeGreaterThanOrEqual(1920)
      expect(r.year).toBeLessThanOrEqual(2025)
      expect(r.rating).toBeGreaterThanOrEqual(0)
      expect(r.rating).toBeLessThanOrEqual(10)
      expect(r.popularity).toBeGreaterThan(0)
    }
    expect(records[0].title).toBe('The Matrix')
  })

  it('rng is uniform-ish and reproducible', () => {
    const r1 = new Rng(7)
    const r2 = new Rng(7)
    const seq1 = Array.from({ length: 5 }, () => r1.nextU32())
    const seq2 = Array.from({ length: 5 }, () => r2.nextU32())
    expect(seq1).toEqual(seq2)
    const rng = new Rng(99)
    const buckets = new Array(10).fill(0)
    for (let i = 0; i < 20000; i++) buckets[rng.int(0, 9)]++
    for (const b of buckets) expect(Math.abs(b - 2000)).toBeLessThan(250)
  })
})
