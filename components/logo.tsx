/** Wordmark: three rising bars (band levels) beside the name. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-fg">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect x="1" y="13" width="5" height="8" rx="1" fill="var(--accent)" opacity="0.45" />
        <rect x="8.5" y="8" width="5" height="13" rx="1" fill="var(--accent)" opacity="0.7" />
        <rect x="16" y="2" width="5" height="19" rx="1" fill="var(--accent)" />
      </svg>
      {!compact && <span className="text-lg">BandUp</span>}
    </span>
  );
}
