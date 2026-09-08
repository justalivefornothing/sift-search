export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path d="M7 9h18l-7 8v6l-4 2v-8z" fill="none" stroke="var(--sift-accent-ink)" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="23.5" cy="22.5" r="2.2" fill="#fde68a" />
    </svg>
  )
}
