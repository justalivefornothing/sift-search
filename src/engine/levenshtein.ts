/**
 * Damerau–Levenshtein distance (optimal string alignment variant): the minimum
 * number of insertions, deletions, substitutions and adjacent transpositions
 * needed to turn `a` into `b`.
 *
 * `max` is an optional cut-off: as soon as no alignment can finish within
 * `max`, the function returns `max + 1`, which keeps bounded comparisons cheap.
 */
export function damerauLevenshtein(a: string, b: string, max = Number.POSITIVE_INFINITY): number {
  if (a === b) return 0
  const n = a.length
  const m = b.length
  if (n === 0) return m > max ? max + 1 : m
  if (m === 0) return n > max ? max + 1 : n
  if (Math.abs(n - m) > max) return max + 1

  // three rolling rows: two back (for transposition), one back, current
  let prev2 = new Int32Array(m + 1)
  let prev = new Int32Array(m + 1)
  let cur = new Int32Array(m + 1)
  for (let j = 0; j <= m; j++) prev[j] = j

  for (let i = 1; i <= n; i++) {
    cur[0] = i
    let rowMin = i
    const ai = a.charCodeAt(i - 1)
    for (let j = 1; j <= m; j++) {
      const bj = b.charCodeAt(j - 1)
      const cost = ai === bj ? 0 : 1
      let v = prev[j - 1] + cost // substitution / match
      const del = prev[j] + 1 // delete from a
      if (del < v) v = del
      const ins = cur[j - 1] + 1 // insert into a
      if (ins < v) v = ins
      if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === bj) {
        const tr = prev2[j - 2] + 1
        if (tr < v) v = tr
      }
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    const tmp = prev2
    prev2 = prev
    prev = cur
    cur = tmp
  }
  const d = prev[m]
  return d > max ? max + 1 : d
}
