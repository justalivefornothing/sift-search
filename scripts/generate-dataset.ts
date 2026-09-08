/**
 * CLI: regenerate public/data/records.json deterministically.
 *
 *   npm run dataset            → 10,000 records, seed 20260907
 *   npm run dataset -- 12000   → custom count
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateDataset } from './dataset/generator.ts'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../public/data/records.json')
const total = Number(process.argv[2] ?? 10000)
const seed = Number(process.argv[3] ?? 20260907)

const t0 = performance.now()
const records = generateDataset(seed, total)
const json = JSON.stringify(records)
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, json)

const genres = new Set(records.flatMap((r) => r.genres))
console.log(`wrote ${records.length} records (${(json.length / 1024 / 1024).toFixed(2)} MB) to ${out}`)
console.log(`seed=${seed} genres=${genres.size} years=${Math.min(...records.map((r) => r.year))}–${Math.max(...records.map((r) => r.year))} in ${(performance.now() - t0).toFixed(0)} ms`)
