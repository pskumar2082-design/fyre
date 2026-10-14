'use client';

import { useEffect, useRef, useState } from 'react';

// One SVG chart for the Movie Stats dashboard: bars and/or lines over a
// category axis (dates, days, refresh times), with a crosshair, a tooltip
// that follows the pointer (mouse, pen or touch) and up to two value axes.
// Two axes are only ever used for different units (INR vs USD): they are
// separate scales, never one number added to another.
// No chart library: plain SVG sized to its container.

export type ChartSeries = {
  key: string;
  name: string;
  type: 'bar' | 'line' | 'area';
  color: string;
  values: (number | null)[];
  axis?: 'left' | 'right';
  dashed?: boolean;
  colorAt?: (i: number) => string; // bars: a different color per point (e.g. later days)
  hidden?: boolean;
};

export type ChartProps = {
  labels: string[]; // x categories
  tooltipLabels?: string[]; // fuller label per point for the tooltip
  series: ChartSeries[];
  format: (v: number) => string; // left axis
  formatValue?: (v: number, axis: 'left' | 'right') => string; // tooltip / table (full precision); defaults to the axis format
  formatRight?: (v: number) => string;
  height?: number;
  stacked?: boolean;
  zeroBased?: boolean;
  ariaLabel: string;
  markers?: { index: number; label: string }[]; // vertical guide lines (e.g. end of tracking window)
};

function niceStep(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

// Upper bound that splits into four round steps (0, 10, 20, 30, 40 Cr).
function niceMax(v: number, lo = 0): number {
  if (v <= lo) return lo + 1;
  return lo + niceStep((v - lo) / 4) * 4;
}

export function useWidth<T extends HTMLElement>(initial = 720) {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((e) => {
      const cw = Math.round(e[0].contentRect.width);
      if (cw > 0) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width: w };
}

export default function StatsChart({ labels, tooltipLabels, series, format, formatValue, formatRight, height = 280, stacked = false, zeroBased = true, ariaLabel, markers = [] }: ChartProps) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const visible = series.filter((s) => !s.hidden);
  const hasRight = visible.some((s) => s.axis === 'right');
  const narrow = width < 480;
  const pad = { l: narrow ? 52 : 64, r: hasRight ? (narrow ? 52 : 64) : 12, t: 12, b: 26 };
  const W = Math.max(240, width);
  const H = height;
  const n = labels.length;
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const scale = (() => {
    const ext = (axis: 'left' | 'right') => {
      const ss = visible.filter((s) => (s.axis ?? 'left') === axis);
      let max = 0;
      let min = Infinity;
      if (stacked && axis === 'left') {
        for (let i = 0; i < n; i++) max = Math.max(max, ss.filter((s) => s.type === 'bar').reduce((a, s) => a + (s.values[i] ?? 0), 0));
        for (const s of ss.filter((x) => x.type !== 'bar')) for (const v of s.values) if (v != null) max = Math.max(max, v);
      } else for (const s of ss) for (const v of s.values) if (v != null) max = Math.max(max, v);
      for (const s of ss) for (const v of s.values) if (v != null) min = Math.min(min, v);
      const lo = zeroBased || !Number.isFinite(min) ? 0 : Math.max(0, min - (max - min) * 0.1);
      return { lo, hi: niceMax(max, lo) };
    };
    return { left: ext('left'), right: ext('right') };
  })();

  const band = n > 0 ? plotW / n : plotW;
  const xc = (i: number) => pad.l + band * i + band / 2;
  const y = (v: number, axis: 'left' | 'right' = 'left') => {
    const s = scale[axis];
    return pad.t + (1 - (v - s.lo) / (s.hi - s.lo || 1)) * plotH;
  };
  const bars = visible.filter((s) => s.type === 'bar');
  const barW = Math.max(1.5, Math.min(36, band * (stacked || bars.length <= 1 ? 0.68 : 0.8 / bars.length)));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / (narrow ? 56 : 72)))));

  const pick = (clientX: number) => {
    const el = ref.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = Math.floor((px - pad.l) / band);
    setHover(i >= 0 && i < n ? i : null);
  };

  const path = (s: ChartSeries) => {
    const axis = s.axis ?? 'left';
    const segs: string[] = [];
    let cur = '';
    s.values.forEach((v, i) => {
      if (v == null) {
        if (cur) segs.push(cur);
        cur = '';
        return;
      }
      cur += `${cur ? 'L' : 'M'}${xc(i).toFixed(1)},${y(v, axis).toFixed(1)}`;
    });
    if (cur) segs.push(cur);
    return segs;
  };

  const fmtV = (v: number, axis: 'left' | 'right') => (formatValue ? formatValue(v, axis) : axis === 'right' && formatRight ? formatRight(v) : format(v));
  const tipLeft = hover != null ? (xc(hover) / W) * 100 : 0;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height: H }}>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        className="block touch-pan-y"
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((f) => {
          const v = scale.left.lo + f * (scale.left.hi - scale.left.lo);
          return (
            <g key={f}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="fill-textFaint font-mono" fontSize="10.5">
                {format(v)}
              </text>
              {hasRight && formatRight && (
                <text x={W - pad.r + 8} y={y(v) + 4} textAnchor="start" className="fill-textFaint font-mono" fontSize="10.5">
                  {formatRight(scale.right.lo + f * (scale.right.hi - scale.right.lo))}
                </text>
              )}
            </g>
          );
        })}
        {labels.map((l, i) =>
          i % every === 0 || i === n - 1 ? (
            <text key={i} x={xc(i)} y={H - 8} textAnchor="middle" className="fill-textFaint font-mono" fontSize="10.5">
              {i !== n - 1 && n - 1 - i < every ? '' : l}
            </text>
          ) : null
        )}
        {markers.map((mk) =>
          mk.index >= 0 && mk.index < n ? (
            <g key={mk.label}>
              <line x1={pad.l + band * mk.index} x2={pad.l + band * mk.index} y1={pad.t} y2={pad.t + plotH} stroke="rgba(251,191,36,0.45)" strokeDasharray="3 4" />
              <text x={pad.l + band * mk.index + (mk.index > n * 0.7 ? -4 : 4)} y={pad.t + 10} textAnchor={mk.index > n * 0.7 ? 'end' : 'start'} className="fill-gold font-mono" fontSize="10">
                {mk.label}
              </text>
            </g>
          ) : null
        )}
        {hover != null && <rect x={pad.l + band * hover} y={pad.t} width={band} height={plotH} fill="rgba(255,255,255,0.04)" />}
        {/* bars */}
        {bars.map((s, bi) =>
          s.values.map((v, i) => {
            if (v == null) return null;
            const axis = s.axis ?? 'left';
            let base = scale[axis].lo;
            if (stacked) for (const prev of bars.slice(0, bi)) base += prev.values[i] ?? 0;
            const top = y(base + v, axis);
            const bottom = y(base, axis);
            const x0 = stacked || bars.length <= 1 ? xc(i) - barW / 2 : xc(i) - (barW * bars.length) / 2 + barW * bi;
            return <rect key={`${s.key}-${i}`} x={x0} y={top} width={barW} height={Math.max(0.5, bottom - top)} rx={Math.min(3, barW / 4)} fill={s.colorAt ? s.colorAt(i) : s.color} opacity={hover == null || hover === i ? 1 : 0.55} />;
          })
        )}
        {/* lines / areas */}
        {visible
          .filter((s) => s.type !== 'bar')
          .map((s) => (
            <g key={s.key}>
              {s.type === 'area' &&
                path(s).map((d, k) => {
                  const xs = d.match(/[ML]([\d.]+),/g)?.map((m) => m.slice(1, -1)) ?? [];
                  const first = xs[0];
                  const last = xs[xs.length - 1];
                  return <path key={`a${k}`} d={`${d}L${last},${pad.t + plotH}L${first},${pad.t + plotH}Z`} fill={s.color} opacity={0.12} />;
                })}
              {path(s).map((d, k) => (
                <path key={k} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" />
              ))}
              {s.values.map((v, i) => (v != null && (hover === i || s.values.filter((x) => x != null).length === 1) ? <circle key={i} cx={xc(i)} cy={y(v, s.axis ?? 'left')} r={3.5} fill={s.color} stroke="#000" strokeWidth={1.5} /> : null))}
            </g>
          ))}
        {hover != null && <line x1={xc(hover)} x2={xc(hover)} y1={pad.t} y2={pad.t + plotH} stroke="rgba(255,255,255,0.28)" strokeDasharray="2 3" />}
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[150px] max-w-[240px] rounded-lg border border-white/10 bg-black/90 px-3 py-2 shadow-lift backdrop-blur"
          style={tipLeft > 60 ? { right: `${100 - tipLeft + 2}%` } : { left: `${tipLeft + 2}%` }}
        >
          <div className="text-[11px] font-semibold text-text">{(tooltipLabels ?? labels)[hover]}</div>
          <div className="mt-1 space-y-0.5">
            {visible.map((s) => {
              const v = s.values[hover];
              return (
                <div key={s.key} className="flex items-center justify-between gap-3 text-[11.5px]">
                  <span className="flex items-center gap-1.5 text-textDim">
                    <span className="inline-block h-[3px] w-3 rounded" style={{ background: s.colorAt ? s.colorAt(hover) : s.color }} />
                    {s.name}
                  </span>
                  <span className="font-mono tabular-nums text-text">{v == null ? '—' : fmtV(v, s.axis ?? 'left')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="sr-only">
      <table>
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>Point</th>
            {visible.map((s) => (
              <th key={s.key}>{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => (
            <tr key={i}>
              <td>{(tooltipLabels ?? labels)[i]}</td>
              {visible.map((s) => (
                <td key={s.key}>{s.values[i] == null ? '—' : fmtV(s.values[i] as number, s.axis ?? 'left')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
