/**
 * Unicode-aware tokenizer.
 *
 * Rules (applied per code point so that offsets into the ORIGINAL string are
 * preserved even when normalisation changes the string length):
 *  1. NFKD decomposition, then strip combining marks (diacritics) → "Amélie" ⇢ "amelie", "ﬁ" ⇢ "fi"
 *  2. lowercase
 *  3. anything that is not a letter or a digit is a separator (spaces, hyphens,
 *     punctuation): "sci-fi" ⇢ ["sci", "fi"]
 *  4. apostrophes are joiners, not separators: "Ocean's" ⇢ "oceans"
 *  5. a lowercase→uppercase boundary splits camelCase: "BladeRunner" ⇢ ["blade", "runner"]
 *
 * ASCII characters take a fast path (no regex, no normalisation); everything
 * else goes through the general Unicode path.
 */

export interface Token {
  /** normalised token text */
  text: string
  /** start offset (inclusive) in the original string, UTF-16 units */
  start: number
  /** end offset (exclusive) in the original string */
  end: number
}

const MARKS = /\p{M}/gu
const ALNUM = /^[\p{L}\p{N}]+$/u
const LOWER = /\p{Ll}/u
const UPPER = /\p{Lu}/u

/** letters that NFKD leaves intact but users expect to fold */
const EXTRA_FOLDS: Record<string, string> = {
  ł: 'l', ø: 'o', đ: 'd', ð: 'd', þ: 'th', ß: 'ss', æ: 'ae', œ: 'oe', ı: 'i', ħ: 'h', ŧ: 't', ŋ: 'n', ĸ: 'k',
}
const EXTRA_FOLD_RE = /[łøđðþßæœıħŧŋĸ]/g

function fold(ch: string): string {
  const base = ch.normalize('NFKD').replace(MARKS, '').toLowerCase()
  return base.replace(EXTRA_FOLD_RE, (c) => EXTRA_FOLDS[c])
}

const CODE_APOSTROPHE = 0x27
const CODE_RIGHT_QUOTE = 0x2019
const CODE_MODIFIER_APOSTROPHE = 0x2bc

/** Normalise a single word the same way the tokenizer does (fold + lowercase, keep alnum only). */
export function normalizeWord(word: string): string {
  return fold(word).replace(/[^\p{L}\p{N}]+/gu, '')
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  const n = input.length
  // A token is "clean" while it is plain lowercase ASCII letters/digits with no
  // skipped characters: its text is then just input.slice(start, end) and no
  // per-character string building is needed. Any transformation (uppercase,
  // diacritics, joiner apostrophe) switches to the explicit buffer.
  let open = false
  let dirty = false
  let buf = ''
  let start = -1
  let end = -1
  let prevWasLower = false

  const flush = (): void => {
    if (open) tokens.push({ text: dirty ? buf : input.slice(start, end), start, end })
    open = false
    dirty = false
    buf = ''
    prevWasLower = false
  }
  const materialize = (): void => {
    if (!dirty) {
      buf = input.slice(start, end)
      dirty = true
    }
  }

  let i = 0
  while (i < n) {
    const code = input.charCodeAt(i)

    if (code < 128) {
      // ---- ASCII fast path ----
      const isUpper = code >= 65 && code <= 90
      const isLower = code >= 97 && code <= 122
      const isDigit = code >= 48 && code <= 57
      if (isUpper || isLower || isDigit) {
        if (open && prevWasLower && isUpper) flush()
        if (!open) {
          open = true
          start = i
          end = i
        }
        if (isUpper) {
          materialize()
          buf += String.fromCharCode(code + 32)
        } else if (dirty) {
          buf += input[i]
        }
        end = i + 1
        prevWasLower = isLower
      } else if (code === CODE_APOSTROPHE) {
        if (open) materialize() // joiner: the slice would include the apostrophe
      } else {
        flush()
      }
      i++
      continue
    }

    // ---- general Unicode path ----
    const cp = input.codePointAt(i) as number
    const ch = String.fromCodePoint(cp)
    const next = i + ch.length

    if (cp === CODE_RIGHT_QUOTE || cp === CODE_MODIFIER_APOSTROPHE) {
      if (open) materialize()
      i = next
      continue
    }

    const folded = fold(ch)
    if (folded.length === 0) {
      // pure combining mark (decomposed input) – attaches to the current token
      if (open) {
        materialize()
        end = next
      }
      i = next
      continue
    }

    if (ALNUM.test(folded)) {
      const isUpper = UPPER.test(ch)
      if (open && prevWasLower && isUpper) flush()
      if (!open) {
        open = true
        start = i
        end = i
      }
      materialize()
      buf += folded
      end = next
      prevWasLower = LOWER.test(ch)
    } else {
      flush()
    }
    i = next
  }
  flush()
  return tokens
}

/** Convenience: normalised token strings only. */
export function tokenizeToStrings(input: string): string[] {
  const tokens = tokenize(input)
  const out = new Array<string>(tokens.length)
  for (let i = 0; i < tokens.length; i++) out[i] = tokens[i].text
  return out
}
