import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { planQuery, typoBudget } from './query-planner.ts'
import { SearchIndex } from './search-index.ts'
import type { SearchRecord } from './types.ts'

function rec(partial: Partial<SearchRecord> & { title: string }): SearchRecord {
  return {
    id: partial.title.toLowerCase().replace(/\W+/g, '-'),
    description: '',
    genres: ['Drama'],
    year: 2000,
    rating: 7,
    popularity: 100,
    ...partial,
  }
}

const FIXTURE: SearchRecord[] = [
  rec({ title: 'The Matrix', year: 1999, genres: ['Sci-Fi', 'Action'], rating: 8.7, popularity: 900, description: 'A hacker discovers reality is a simulation.' }),
  rec({ title: 'The Matrix Reloaded', year: 2003, genres: ['Sci-Fi', 'Action'], rating: 7.2, popularity: 600, description: 'The machines dig toward Zion.' }),
  rec({ title: 'Matrimony Blues', year: 1988, genres: ['Comedy'], rating: 6.1, popularity: 5000, description: 'Two families collide at a wedding.' }),
  rec({ title: 'Star Wars', year: 1977, genres: ['Sci-Fi'], rating: 8.6, popularity: 950, description: 'A farm boy joins a rebellion.' }),
  rec({ title: 'Star Trek', year: 2009, genres: ['Sci-Fi'], rating: 7.9, popularity: 800, description: 'A young crew takes command of a starship.' }),
  rec({ title: 'Wars of the Roses', year: 1965, genres: ['History'], rating: 7.0, popularity: 10, description: 'Rival houses fight for the crown.' }),
  rec({ title: 'Amélie', year: 2001, genres: ['Comedy', 'Romance'], rating: 8.3, popularity: 700, description: 'A shy waitress fixes the lives around her.' }),
  rec({ title: 'Inception', year: 2010, genres: ['Sci-Fi', 'Thriller'], rating: 8.8, popularity: 990, description: 'A thief plants an idea inside a dream. The matrix of dreams has many levels.' }),
  rec({ title: 'Heat', year: 1995, genres: ['Crime'], rating: 8.3, popularity: 400, description: 'A thief and a detective circle each other.' }),
]

describe('SearchIndex (fixture)', () => {
  const index = new SearchIndex(FIXTURE)

  it('typo query "matrx" returns "The Matrix" first', () => {
    const r = index.search({ query: 'matrx' })
    expect(r.hits[0].title).toBe('The Matrix')
    expect(r.hits[0]._rankingInfo.typos).toBe(1)
    expect(r.hits[0]._highlightResult.title.value).toBe('The <mark>Matrix</mark>')
    // exact (whole-word) typo match outranks the prefix-only typo match "Matrimony", despite its popularity
    const titles = r.hits.map((h) => h.title)
    expect(titles.indexOf('The Matrix')).toBeLessThan(titles.indexOf('Matrimony Blues'))
    expect(r.parsedQuery[0]).toMatchObject({ word: 'matrx', maxTypos: 1, prefix: true })
  })

  it('a two-word query ranks a title containing both words above one containing one word', () => {
    const r = index.search({ query: 'star wars' })
    const titles = r.hits.map((h) => h.title)
    expect(titles[0]).toBe('Star Wars')
    expect(r.hits[0]._rankingInfo.words).toBe(2)
    expect(titles).toContain('Star Trek')
    expect(titles).toContain('Wars of the Roses')
    expect(titles.indexOf('Star Wars')).toBeLessThan(titles.indexOf('Star Trek'))
    expect(titles.indexOf('Star Wars')).toBeLessThan(titles.indexOf('Wars of the Roses'))
    // the second hit was separated from the first by the words criterion
    expect(r.hits[1]._rankingInfo.tieBreak?.criterion).toBe('words')
  })

  it('prefers title matches over description matches (attribute criterion)', () => {
    const r = index.search({ query: 'matrix' })
    const titles = r.hits.map((h) => h.title)
    expect(titles.slice(0, 2)).toEqual(['The Matrix', 'The Matrix Reloaded'])
    const inception = r.hits.find((h) => h.title === 'Inception')!
    expect(inception._rankingInfo.attribute).toBe(2)
    expect(inception._rankingInfo.attributeName).toBe('description')
    expect(inception._snippetResult.description.value).toContain('<mark>matrix</mark>')
  })

  it('exposes the six-criterion ranking vector and the tie-break on every hit', () => {
    const r = index.search({ query: 'the matrix' })
    for (const hit of r.hits) {
      const ri = hit._rankingInfo
      for (const key of ['typos', 'words', 'proximity', 'attribute', 'exactness', 'popularity'] as const) {
        expect(typeof ri[key]).toBe('number')
      }
    }
    expect(r.hits[0]._rankingInfo.tieBreak).toBeNull()
    expect(r.hits[1]._rankingInfo.tieBreak).toEqual({ criterion: 'popularity', previous: 900, current: 600 })
    expect(r.hits[0]._rankingInfo.proximity).toBe(1)
  })

  it('proximity prefers adjacent words', () => {
    const r = index.search({ query: 'thief detective' })
    expect(r.hits[0].title).toBe('Heat')
    expect(r.hits[0]._rankingInfo.proximity).toBeGreaterThan(1)
    const near = new SearchIndex([
      rec({ title: 'A', description: 'the thief detective story', popularity: 1 }),
      rec({ title: 'B', description: 'the thief met a weary old detective', popularity: 999 }),
    ]).search({ query: 'thief detective' })
    expect(near.hits.map((h) => h.title)).toEqual(['A', 'B'])
    expect(near.hits[1]._rankingInfo.tieBreak?.criterion).toBe('proximity')
  })

  it('folds diacritics both ways', () => {
    expect(index.search({ query: 'amelie' }).hits[0].title).toBe('Amélie')
    expect(index.search({ query: 'Amélie' }).hits[0]._highlightResult.title.value).toBe('<mark>Amélie</mark>')
  })

  it('applies typo budgets: 0 below 4 chars, 1 from 4, 2 from 8', () => {
    expect(typoBudget('mat')).toBe(0)
    expect(typoBudget('matr')).toBe(1)
    expect(typoBudget('matrixes')).toBe(2)
    expect(index.search({ query: 'mtrx' }).hits.map((h) => h.title)).not.toContain('The Matrix') // 2 edits, budget 1
    expect(index.search({ query: 'reloded' }).hits[0]?.title).toBe('The Matrix Reloaded') // 7 chars, 1 edit
    expect(index.search({ query: 'ma', typoTolerance: true }).parsedQuery[0].maxTypos).toBe(0)
  })

  it('treats a trailing space as "word complete" (no prefix expansion)', () => {
    const open = planQuery(index.inverted, 'sta', { typoTolerance: true, prefixLast: true })
    const closed = planQuery(index.inverted, 'sta ', { typoTolerance: true, prefixLast: true })
    expect(open.words[0].prefix).toBe(true)
    expect(closed.words[0].prefix).toBe(false)
    expect(index.search({ query: 'sta' }).nbHits).toBeGreaterThan(0)
    expect(index.search({ query: 'sta ' }).nbHits).toBe(0)
  })

  it('filters by facets with live counts and reports zero-result suggestions', () => {
    const all = index.search({ query: '' })
    expect(all.nbHits).toBe(FIXTURE.length)
    expect(all.facets.genre['Sci-Fi']).toBe(5)

    const filtered = index.search({ query: 'star', facetFilters: [['decade:1970s']] })
    expect(filtered.nbHits).toBe(1)
    expect(filtered.hits[0].title).toBe('Star Wars')
    expect(filtered.facets.decade).toEqual({ '1970s': 1, '2000s': 1 })
    expect(filtered.suggestions).toEqual([])

    // 'inceptoin' is one transposition away → still found; two edits on a 6-letter word are not
    expect(index.search({ query: 'inceptoin' }).hits[0].title).toBe('Inception')
    const none = index.search({ query: 'amalia' })
    expect(none.nbHits).toBe(0)
    expect(none.suggestions).toEqual(['amelie'])
    const nothing = index.search({ query: 'zzzzzzzz' })
    expect(nothing.nbHits).toBe(0)
    expect(nothing.suggestions).toEqual([])
  })

  it('paginates and keeps the tie-break relative to the previous page', () => {
    const p0 = index.search({ query: '', hitsPerPage: 3, page: 0 })
    const p1 = index.search({ query: '', hitsPerPage: 3, page: 1 })
    expect(p0.nbPages).toBe(3)
    expect(p0.hits.map((h) => h.title)).toEqual(['Matrimony Blues', 'Inception', 'Star Wars'])
    expect(p1.hits[0].title).toBe('The Matrix')
    expect(p1.hits[0]._rankingInfo.tieBreak).toEqual({ criterion: 'popularity', previous: 950, current: 900 })
    expect(p0.params).toContain('hitsPerPage=3')
  })

  it('reports processing time and index stats', () => {
    const r = index.search({ query: 'matrix' })
    expect(r.processingTimeMS).toBeGreaterThanOrEqual(0)
    expect(index.stats.records).toBe(FIXTURE.length)
    expect(index.stats.terms).toBeGreaterThan(20)
    expect(index.stats.trieNodes).toBeGreaterThan(0)
  })
})

describe('SearchIndex (bundled dataset)', () => {
  const path = resolve(__dirname, '../../public/data/records.json')
  const records = JSON.parse(readFileSync(path, 'utf8')) as SearchRecord[]
  const index = new SearchIndex(records)

  it('has at least 10,000 records', () => {
    expect(records.length).toBeGreaterThanOrEqual(10000)
  })

  it('"matrx" → "The Matrix" first, then the sequels by popularity', () => {
    const r = index.search({ query: 'matrx' })
    expect(r.hits.slice(0, 3).map((h) => h.title)).toEqual(['The Matrix', 'The Matrix Reloaded', 'The Matrix Revolutions'])
    expect(r.hits[1]._rankingInfo.tieBreak?.criterion).toBe('popularity')
  })

  it('two-word query ranks both-word titles first', () => {
    const r = index.search({ query: 'star wars' })
    expect(r.hits[0].title).toBe('Star Wars')
    expect(r.hits[0]._rankingInfo.words).toBe(2)
    expect(r.nbHits).toBeGreaterThan(100) // star / war also appear in synthetic descriptions
    const single = r.hits.find((h) => h._rankingInfo.words === 1)
    expect(single).toBeDefined()
    expect(r.hits.indexOf(single!)).toBeGreaterThan(0)
    const both = index.search({ query: 'blade runner' })
    expect(both.hits.map((h) => h.title)).toEqual(['Blade Runner', 'Blade Runner 2049'])
  })

  it('answers every query in well under the latency budget', () => {
    const queries = ['a', 'the', 'matrix', 'star wars', 'sci fi', 'inceptoin', 'the last lighthouse keeper', 'amelie']
    for (const q of queries) index.search({ query: q }) // warm-up
    // CPU time actually spent inside the engine (user + system), median of a few
    // runs: wall-clock would also count time this process spends waiting for a
    // contended CPU on a busy CI box, which says nothing about the engine.
    const cpuMs = (fn: () => void): number => {
      const before = process.cpuUsage()
      fn()
      const d = process.cpuUsage(before)
      return (d.user + d.system) / 1000
    }
    for (const q of queries) {
      const runs = [0, 1, 2, 3, 4].map(() => cpuMs(() => index.search({ query: q }))).sort((a, b) => a - b)
      expect(runs[2], `query "${q}" cpu ms: ${runs.map((r) => r.toFixed(2)).join(', ')}`).toBeLessThan(20)
    }
  })
})
