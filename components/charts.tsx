// Small dependency-free SVG chart primitives -- no charting library in
// this project, and neither of these needs one: a 3-segment donut (the
// Live/Upcoming/Completed split) and a simple area/line trend (the
// Earning Summary chart, read from tt_daily_snapshot).

// SVG presentation attributes (stroke/fill/stopColor below) can't consume
// Tailwind classes, so the trend line's accent color is named here once
// instead of being repeated as three separate raw-hex copies. Must match
// the `gold` design token in tailwind.config.js exactly -- same reasoning
// as lib/poster/blocks.tsx's own local hex constants (Satori can't
// consume Tailwind or CSS variables either).
const TREND_LINE_COLOR = '#2F6FED';

export type DonutSegment = { label: string; value: number; colorClass: string; dotClass: string };

export function Donut({ segments, size = 168, thickness = 22 }: { segments: DonutSegment[]; size?: number; thickness?: number }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-white/[0.06]" />
        {total > 0 &&
          segments.map((s, i) => {
            const fraction = s.value / total;
            const dash = fraction * circumference;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                className={s.colorClass}
                stroke="currentColor"
                strokeLinecap={segments.length === 1 ? 'round' : 'butt'}
              />
            );
            offset += dash;
            return el;
          })}
      </svg>
      <div className="mt-4 w-full space-y-2.5">
        {segments.map((s, i) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-text font-medium">
                <span className={`w-2.5 h-2.5 rounded-full ${s.dotClass}`} />
                {s.label}
              </span>
              <span className="text-textDim">
                {s.value} <span className="text-textFaint">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type TrendPoint = { date: string; value: number };

export function TrendChart({ points, height = 220 }: { points: TrendPoint[]; height?: number }) {
  const width = 900;
  const padding = { top: 16, right: 16, bottom: 28, left: 44 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(...points.map((p) => p.value), 1);
  const niceMax = Math.ceil(max / 5) * 5 || 5;

  const x = (i: number) => padding.left + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => padding.top + innerH - (v / niceMax) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');
  const areaPath = `${linePath} L ${x(points.length - 1)} ${padding.top + innerH} L ${x(0)} ${padding.top + innerH} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));
  // Thin the x-axis date labels so they don't overlap once there are many days.
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={TREND_LINE_COLOR} stopOpacity="0.22" />
          <stop offset="100%" stopColor={TREND_LINE_COLOR} stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padding.left} x2={width - padding.right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
          <text x={padding.left - 10} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="rgba(255,255,255,0.38)">
            {t}
          </text>
        </g>
      ))}

      {points.length > 1 && <path d={areaPath} fill="url(#trendFill)" />}
      <path d={linePath} fill="none" stroke={TREND_LINE_COLOR} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={points.length < 14 ? 3.5 : 0} fill={TREND_LINE_COLOR} />
      ))}

      {points.map((p, i) =>
        i % labelEvery === 0 || i === points.length - 1 ? (
          <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.38)">
            {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
          </text>
        ) : null
      )}
    </svg>
  );
}
