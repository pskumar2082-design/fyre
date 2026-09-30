import { formatMetric } from '@/lib/analytics/format';
import { METRIC_LABELS } from '@/lib/analytics/metrics';
import type { Comparison } from '@/lib/analytics/types';
import { movieColorHex } from '@/components/compare/movieColors';

// Day 1 -> Day N lines, one per movie, for one metric (daily or running).
// Plain inline SVG; the same numbers are also given as a hidden table.
export default function TrendChart({ trend, titles, height = 240 }: { trend: NonNullable<Comparison['trend']>; titles: string[]; height?: number }) {
  const W = 720;
  const H = height;
  const pad = { l: 64, r: 16, t: 16, b: 28 };
  const values = trend.points.flatMap((p) => p.values).filter((v): v is number => v != null);
  if (!values.length || trend.points.length < 1) return null;
  const max = Math.max(...values) || 1;
  const n = trend.points.length;
  const x = (i: number) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-hidden="true">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.45)">
              {formatMetric(trend.metric, t)}
            </text>
          </g>
        ))}
        {trend.points.map((p, i) => (
          <text key={p.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.45)">
            {n > 14 && i % Math.ceil(n / 14) !== 0 ? '' : `D${p.day}`}
          </text>
        ))}
        {titles.map((_, mi) => {
          const pts = trend.points.map((p, i) => (p.values[mi] == null ? null : ([x(i), y(p.values[mi] as number)] as const)));
          const segs: string[] = [];
          let cur = '';
          for (const pt of pts) {
            if (!pt) {
              if (cur) segs.push(cur);
              cur = '';
              continue;
            }
            cur += `${cur ? 'L' : 'M'}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`;
          }
          if (cur) segs.push(cur);
          return (
            <g key={mi}>
              {segs.map((d, k) => (
                <path key={k} d={d} fill="none" stroke={movieColorHex(mi)} strokeWidth={2.5} />
              ))}
              {pts.map((pt, k) => pt && <circle key={k} cx={pt[0]} cy={pt[1]} r={3} fill={movieColorHex(mi)} />)}
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>
          {METRIC_LABELS[trend.metric]} by release day{trend.cumulative ? ' (running total)' : ''}
        </caption>
        <thead>
          <tr>
            <th>Day</th>
            {titles.map((t) => (
              <th key={t}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trend.points.map((p) => (
            <tr key={p.day}>
              <td>Day {p.day}</td>
              {p.values.map((v, i) => (
                <td key={i}>{formatMetric(trend.metric, v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
