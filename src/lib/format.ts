/** Locale-stable number formatting so the UI reads the same on every machine. */
export function fmtInt(n: number): string {
  return n.toLocaleString('en-US')
}

export function fmtMs(ms: number): string {
  if (ms >= 100) return ms.toFixed(0)
  if (ms >= 10) return ms.toFixed(1)
  return ms.toFixed(2)
}
