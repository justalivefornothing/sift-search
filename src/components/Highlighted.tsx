import { memo, type ReactNode } from 'react'

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

function unescapeHtml(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m])
}

/**
 * Render an engine highlight string (escaped text + <mark> tags) as React
 * nodes, without innerHTML. Text segments are unescaped; marks become <mark>.
 */
export const Highlighted = memo(function Highlighted({ value, className }: { value: string; className?: string }) {
  const nodes: ReactNode[] = []
  const re = /<mark>([\s\S]*?)<\/mark>/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(value)) !== null) {
    if (m.index > last) nodes.push(unescapeHtml(value.slice(last, m.index)))
    nodes.push(<mark key={i++}>{unescapeHtml(m[1])}</mark>)
    last = m.index + m[0].length
  }
  if (last < value.length) nodes.push(unescapeHtml(value.slice(last)))
  return <span className={className}>{nodes}</span>
})
