import { describe, expect, it } from 'vitest'
import { escapeHtml, findMarks, highlight, snippet, wrapMarks } from './highlight.ts'
import { tokenize } from './tokenizer.ts'

const terms = (...groups: string[][]) => groups.map((g) => new Set(g))

describe('highlight', () => {
  it('reports mark offsets into the original text', () => {
    const text = 'The Matrix Reloaded'
    const marks = findMarks(tokenize(text), terms(['matrix']))
    expect(marks).toEqual([{ start: 4, end: 10, word: 0 }])
    expect(text.slice(4, 10)).toBe('Matrix')
  })

  it('wraps matched tokens in <mark> preserving original case and diacritics', () => {
    const r = highlight("Amélie's Café", terms(['amelies'], ['cafe']), ['amelies', 'cafe'])
    expect(r.value).toBe('<mark>Amélie&#39;s</mark> <mark>Café</mark>')
    expect(r.matchLevel).toBe('full')
    expect(r.matchedWords).toEqual(['amelies', 'cafe'])
  })

  it('escapes HTML outside and inside marks', () => {
    expect(escapeHtml('<b>&"\'</b>')).toBe('&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;')
    const r = highlight('Tom & Jerry <3', terms(['jerry']), ['jerry'])
    expect(r.value).toBe('Tom &amp; <mark>Jerry</mark> &lt;3')
    expect(r.matchLevel).toBe('full')
  })

  it('distinguishes none / partial / full match levels', () => {
    const q = ['star', 'wars']
    expect(highlight('Star Wars', terms(['star'], ['wars']), q).matchLevel).toBe('full')
    expect(highlight('Star Trek', terms(['star'], ['wars']), q).matchLevel).toBe('partial')
    expect(highlight('Alien', terms(['star'], ['wars']), q).matchLevel).toBe('none')
  })

  it('wrapMarks clips ranges to a window', () => {
    const text = 'aa bb cc dd'
    const ranges = [
      { start: 3, end: 5, word: 0 },
      { start: 9, end: 11, word: 0 },
    ]
    expect(wrapMarks(text, ranges, 0, 8)).toBe('aa <mark>bb</mark> cc')
    expect(wrapMarks(text, ranges, 6)).toBe('cc <mark>dd</mark>')
  })
})

describe('snippet', () => {
  const text =
    'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty matrix reloaded twentythree twentyfour twentyfive'

  it('windows around the densest match cluster with ellipses', () => {
    const s = snippet(text, terms(['matrix'], ['reloaded']), ['matrix', 'reloaded'], 8)
    expect(s.value.startsWith('…')).toBe(true)
    expect(s.value).toContain('<mark>matrix</mark> <mark>reloaded</mark>')
    expect(s.matchLevel).toBe('full')
    // 8 words in the window: 3 words of lead context, the two matches, then 3 more
    const plain = s.value.replace(/<\/?mark>/g, '').replace(/…/g, '').trim()
    expect(plain.split(' ')).toHaveLength(8)
    expect(plain).toBe('eighteen nineteen twenty matrix reloaded twentythree twentyfour twentyfive')
  })

  it('falls back to the leading window when nothing matches', () => {
    const s = snippet(text, terms(['zzz']), ['zzz'], 4)
    expect(s.value).toBe('One two three four…')
    expect(s.matchLevel).toBe('none')
  })

  it('returns the whole text when it fits', () => {
    const s = snippet('The Matrix', terms(['matrix']), ['matrix'], 24)
    expect(s.value).toBe('The <mark>Matrix</mark>')
  })

  it('prefers the window with more matches', () => {
    const t = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu alpha alpha beta'
    const s = snippet(t, terms(['alpha'], ['beta']), ['alpha', 'beta'], 5)
    expect(s.value.match(/<mark>/g)).toHaveLength(3)
  })
})
