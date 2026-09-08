/**
 * Benchmark: index the bundled dataset and measure query latency in Node.
 *
 *   npm run bench            → prints a table, writes docs/bench.json
 *   npm run bench -- 5000    → custom number of random queries
 *
 * Query mix (seeded, reproducible): single words, prefixes of words (as-you-type),
 * typo-injected words, two- and three-word phrases, and faceted queries.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SearchIndex, tokenizeToStrings, type QueryParams, type SearchRecord } from '../src/engine/index.ts'
import { generateDataset } from './dataset/generator.ts'
import { Rng } from './dataset/rng.ts'

const here = dirname(fileURLToPath(import.meta.url))
const dataPath = resolve(here, '../public/data/records.json')
const outPath = resolve(here, '../docs/bench.json')
const queryCount = Number(process.argv[2] ?? 1000)

function loadRecords(): SearchRecord[] {
  if (existsSync(dataPath)) return JSON.parse(readFileSync(dataPath, 'utf8')) as SearchRecord[]
  console.log('dataset missing, generating in memory')
  return generateDataset()
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

function injectTypo(rng: Rng, word: string): string {
  if (word.length < 4) return word
  const i = rng.int(0, word.length - 1)
  switch (rng.int(0, 3)) {
    case 0:
      return word.slice(0, i) + word.slice(i + 1) // deletion
    case 1:
      return word.slice(0, i) + rng.pick(['a', 'e', 'o', 'r', 't', 'x']) + word.slice(i) // insertion
    case 2:
      return word.slice(0, i) + rng.pick(['a', 'e', 'o', 'r', 't', 'x']) + word.slice(i + 1) // substitution
    default: {
      if (i >= word.length - 1) return word.slice(0, i - 1) + word[i] + word[i - 1]
      return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2) // transposition
    }
  }
}

interface Mixed {
  kind: string
  params: QueryParams
}

function buildQueries(rng: Rng, records: SearchRecord[], n: number): Mixed[] {
  const out: Mixed[] = []
  for (let i = 0; i < n; i++) {
    const rec = rng.pick(records)
    const words = tokenizeToStrings(rec.title + ' ' + rec.description).filter((w) => w.length >= 3)
    const w1 = rng.pick(words)
    const w2 = rng.pick(words)
    const kind = rng.int(0, 5)
    switch (kind) {
      case 0:
        out.push({ kind: 'word', params: { query: w1 } })
        break
      case 1:
        out.push({ kind: 'prefix', params: { query: w1.slice(0, rng.int(1, Math.max(1, w1.length - 1))) } })
        break
      case 2:
        out.push({ kind: 'typo', params: { query: injectTypo(rng, w1) } })
        break
      case 3:
        out.push({ kind: 'two-words', params: { query: `${w1} ${w2}` } })
        break
      case 4:
        out.push({ kind: 'three-words', params: { query: `${w1} ${w2} ${rng.pick(words)}` } })
        break
      default:
        out.push({
          kind: 'faceted',
          params: { query: w1.slice(0, 3), facetFilters: [[`genre:${rng.pick(rec.genres)}`], [`decade:${Math.floor(rec.year / 10) * 10}s`]] },
        })
    }
  }
  return out
}

function main(): void {
  const records = loadRecords()
  const rng = new Rng(4242)

  const tIndex0 = performance.now()
  const index = new SearchIndex(records)
  const indexMs = performance.now() - tIndex0

  const queries = buildQueries(rng, records, queryCount)
  // warm up the JIT with a slice of the mix
  for (const q of queries.slice(0, Math.min(200, queries.length))) index.search(q.params)

  const byKind = new Map<string, number[]>()
  const all: number[] = []
  let totalHits = 0
  for (const q of queries) {
    const t0 = performance.now()
    const r = index.search(q.params)
    const ms = performance.now() - t0
    all.push(ms)
    totalHits += r.nbHits
    let bucket = byKind.get(q.kind)
    if (!bucket) byKind.set(q.kind, (bucket = []))
    bucket.push(ms)
  }
  all.sort((a, b) => a - b)

  const rows = [...byKind.entries()].map(([kind, arr]) => {
    arr.sort((a, b) => a - b)
    return { kind, n: arr.length, p50: percentile(arr, 50), p95: percentile(arr, 95), p99: percentile(arr, 99), max: arr[arr.length - 1] }
  })
  const summary = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    records: records.length,
    terms: index.stats.terms,
    postings: index.stats.postings,
    positions: index.stats.positions,
    trieNodes: index.stats.trieNodes,
    approxIndexMB: Math.round((index.stats.approxBytes / 1048576) * 100) / 100,
    indexMs: Math.round(indexMs * 10) / 10,
    queries: all.length,
    avgHits: Math.round(totalHits / all.length),
    latencyMs: {
      p50: Math.round(percentile(all, 50) * 1000) / 1000,
      p95: Math.round(percentile(all, 95) * 1000) / 1000,
      p99: Math.round(percentile(all, 99) * 1000) / 1000,
      max: Math.round(all[all.length - 1] * 1000) / 1000,
      mean: Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 1000) / 1000,
    },
    byKind: rows.map((r) => ({ ...r, p50: round3(r.p50), p95: round3(r.p95), p99: round3(r.p99), max: round3(r.max) })),
  }

  console.log(`indexed ${records.length} records in ${summary.indexMs} ms  (${index.stats.terms} terms, ${index.stats.postings} postings, ${index.stats.trieNodes} trie nodes, ~${summary.approxIndexMB} MB)`)
  console.log(`${all.length} queries · avg ${summary.avgHits} hits`)
  console.log(`latency  p50 ${summary.latencyMs.p50} ms   p95 ${summary.latencyMs.p95} ms   p99 ${summary.latencyMs.p99} ms   max ${summary.latencyMs.max} ms`)
  console.log('')
  console.log('kind         n     p50      p95      p99      max')
  for (const r of summary.byKind) {
    console.log(`${r.kind.padEnd(12)} ${String(r.n).padStart(3)}  ${fmt(r.p50)}  ${fmt(r.p95)}  ${fmt(r.p99)}  ${fmt(r.max)}`)
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n')
  console.log(`\nwrote ${outPath}`)

  const budget = 20
  if (summary.latencyMs.p95 > budget) {
    console.error(`FAIL: p95 ${summary.latencyMs.p95} ms exceeds the ${budget} ms budget`)
    process.exitCode = 1
  } else {
    console.log(`OK: p95 ${summary.latencyMs.p95} ms is within the ${budget} ms budget`)
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function fmt(n: number): string {
  return `${n.toFixed(3)}`.padStart(7)
}

main()
