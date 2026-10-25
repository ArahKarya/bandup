import type { ReactNode } from "react";

/** SVG gauges. Server-safe (no client JS), sized by props, coloured by CSS variables. */

interface RingProps {
  /** 0–1 */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  children?: ReactNode;
}

/** Circular progress, e.g. today's study minutes against the daily goal. */
export function ProgressRing({ value, size = 88, stroke = 8, color = "var(--accent)", label, children }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(pct * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 600ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

interface GaugeProps {
  band: number | null;
  target: number;
  size?: number;
  label: string;
  caption?: ReactNode;
}

const MIN = 3;
const MAX = 9;

/** Point on the semicircle for a band between MIN and MAX (left = MIN, right = MAX). */
function point(band: number, cx: number, cy: number, r: number): [number, number] {
  const t = (Math.max(MIN, Math.min(MAX, band)) - MIN) / (MAX - MIN);
  const angle = Math.PI * (1 - t);
  return [cx + r * Math.cos(angle), cy - r * Math.sin(angle)];
}

/**
 * Semicircle from band 3 to 9 with the current estimate filled and a tick at the target,
 * so "how far am I" reads at a glance.
 */
export function BandGauge({ band, target, size = 220, label, caption }: GaugeProps) {
  const stroke = 16;
  const r = size / 2 - stroke;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const arc = (to: number) => {
    const [x0, y0] = point(MIN, cx, cy, r);
    const [x1, y1] = point(to, cx, cy, r);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  };
  const [tx, ty] = point(target, cx, cy, r + stroke / 2 + 4);
  const [ix, iy] = point(target, cx, cy, r - stroke / 2 - 4);
  const tone = band === null ? "var(--border)" : band >= target ? "var(--success)" : band >= target - 0.5 ? "var(--warning)" : "var(--accent)";

  return (
    <div className="flex flex-col items-center" role="img" aria-label={label}>
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <path d={arc(MAX)} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        {band !== null && band > MIN && <path d={arc(band)} fill="none" stroke={tone} strokeWidth={stroke} style={{ transition: "all 600ms ease-out" }} />}
        <line x1={ix} y1={iy} x2={tx} y2={ty} stroke="var(--text)" strokeWidth={2.5} />
        <text x={point(MIN, cx, cy, r)[0]} y={cy + 16} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
          {MIN}
        </text>
        <text x={point(MAX, cx, cy, r)[0]} y={cy + 16} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
          {MAX}
        </text>
      </svg>
      <div className="-mt-16 flex flex-col items-center">
        <span className="text-4xl font-semibold tabular-nums">{band === null ? "—" : band.toFixed(1)}</span>
        {caption && <span className="mt-0.5 text-xs text-muted">{caption}</span>}
      </div>
    </div>
  );
}

/** Horizontal bar to a band with a target tick. */
export function BandBar({ band, target, color }: { band: number | null; target: number; color: string }) {
  const pct = (b: number) => `${(Math.max(0, Math.min(9, b)) / 9) * 100}%`;
  return (
    <div className="relative h-2 w-full rounded-sm bg-surface-2">
      {band !== null && <div className="h-full rounded-sm" style={{ width: pct(band), background: color, transition: "width 600ms ease-out" }} />}
      <div className="absolute -top-1 h-4 w-0.5 bg-fg" style={{ left: pct(target) }} aria-hidden="true" />
    </div>
  );
}
