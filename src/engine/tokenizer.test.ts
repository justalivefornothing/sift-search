import { describe, expect, it } from 'vitest'
import { normalizeWord, tokenize, tokenizeToStrings } from './tokenizer.ts'

describe('tokenizer', () => {
  it('lowercases and strips diacritics (NFKD fold)', () => {
    expect(tokenizeToStrings('Amélie')).toEqual(['amelie'])
    expect(tokenizeToStrings('naïve RÉSUMÉ café')).toEqual(['naive', 'resume', 'cafe'])
    expect(tokenizeToStrings('ﬁne')).toEqual(['fine']) // ligature decomposes under NFKD
    expect(tokenizeToStrings('éclair')).toEqual(['eclair']) // decomposed input
  })

  it('folds letters NFKD leaves intact', () => {
    expect(tokenizeToStrings('Søren Łukasz Straße Ærø')).toEqual(['soren', 'lukasz', 'strasse', 'aero'])
  })

  it('splits on hyphens and punctuation, keeps digits', () => {
    expect(tokenizeToStrings('sci-fi')).toEqual(['sci', 'fi'])
    expect(tokenizeToStrings('Terminator 2: Judgment Day')).toEqual(['terminator', '2', 'judgment', 'day'])
    expect(tokenizeToStrings('WALL·E')).toEqual(['wall', 'e'])
    expect(tokenizeToStrings('  spaced   out ')).toEqual(['spaced', 'out'])
    expect(tokenizeToStrings('---')).toEqual([])
    expect(tokenizeToStrings('')).toEqual([])
  })

  it('splits camelCase on a lower→upper boundary only', () => {
    expect(tokenizeToStrings('BladeRunner')).toEqual(['blade', 'runner'])
    expect(tokenizeToStrings('iPhone')).toEqual(['i', 'phone'])
    expect(tokenizeToStrings('NASA')).toEqual(['nasa'])
    expect(tokenizeToStrings('3D')).toEqual(['3d'])
  })

  it('treats apostrophes as joiners', () => {
    expect(tokenizeToStrings("Ocean's Eleven")).toEqual(['oceans', 'eleven'])
    expect(tokenizeToStrings('Zoë’s Lantern')).toEqual(['zoes', 'lantern'])
  })

  it('reports offsets into the original string', () => {
    const tokens = tokenize('Crouching Tiger, Hidden Dragon')
    expect(tokens).toEqual([
      { text: 'crouching', start: 0, end: 9 },
      { text: 'tiger', start: 10, end: 15 },
      { text: 'hidden', start: 17, end: 23 },
      { text: 'dragon', start: 24, end: 30 },
    ])
    const amelie = tokenize("Amélie's café")
    expect(amelie[0]).toEqual({ text: 'amelies', start: 0, end: 8 })
    expect('Amélie\'s café'.slice(amelie[1].start, amelie[1].end)).toBe('café')
  })

  it('normalizeWord matches the tokenizer for single words', () => {
    expect(normalizeWord('Café!')).toBe('cafe')
    expect(normalizeWord('MATRIX')).toBe('matrix')
  })
})
