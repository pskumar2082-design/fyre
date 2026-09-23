import type { ComparedTable, ComparisonMovie } from '@/lib/compare/types';
import { movieColorHex } from './movieColors';

// Dependency-free grouped-bar chart for one metric column of a
// ComparedTable -- no charting library, same "inline SVG" approach as
// components/charts.tsx's own Donut/TrendChart, extended to draw one bar
// PER MOVIE per row instead of one series. Works equally for an ordered
// row axis (Day 1, Day 2, ... from a Day-wise Collection comparison) and
// a categorical one (State/City/Language names from a breakdown
// category) -- both are just "one group of bars per row name".
//
// Accessibility: the bars themselves are hardcoded to whatever unit the
// underlying column already uses (money strings, percentages, etc.) --
// so a bar's *height* is only ever a same-column, same-unit comparison,
// matching the "never combine different units" accuracy rule the rest of
// the comparison feature follows. Because an SVG bar chart has no good
// native text equivalent, the exact same data is also rendered as a
// visually-hidden (`sr-only`) real <table> for screen readers, and the
// SVG itself is marked decorative (aria-hidden) so the data is announced
// exactly once, not twice.
function parseChartValue(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export default function ComparisonChart({
  table,
  column,
  movies,
  height = 260,
  className = ''
}: {
  table: ComparedTable;
  column: string;
  movies: ComparisonMovie[];
  height?: number;
  className?: string;
}) {
  if (!table.columns.includes(column) || table.rows.length === 0) return null;

  const seriesCount = movies.length;
  const values = table.rows.map((row) => row.valuesByColumn[column].map(parseChartValue));
  const numeric = values.flat().filter((v): v is number => v != null);
  if (numeric.length === 0) return null;

  const max = Math.max(0, ...numeric);
  const niceMax = max > 0 ? max * 1.08 : 1;

  const barWidth = 20;
  const barGap = 5;
  const groupInnerWidth = seriesCount * barWidth + (seriesCount - 1) * barGap;
  const groupPad = 20;
  const groupWidth = groupInnerWidth + groupPad;
  const padding = { top: 16, right: 16, bottom: 36, left: 12 };
  const innerH = height - padding.top - padding.bottom;
  const width = Math.max(480, table.rows.length * groupWidth + padding.left + padding.right);

  const summary = `${column} by ${table.nameColumn || 'row'}, comparing ${movies.map((m) => m.details.title).join(', ')}.`;

  return (
    <div className={`overflow-x-auto -mx-1 px-1 ${className}`}>
      <svg width={width} height={height} aria-hidden="true" role="presentation" className="block">
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={height - padding.bottom}
          y2={height - padding.bottom}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={1}
        />
        {table.rows.map((row, ri) => {
          const groupX = padding.left + ri * groupWidth + groupPad / 2;
          const rowValues = values[ri];
          const label = row.name.length > 14 ? `${row.name.slice(0, 13)}…` : row.name;
          return (
            <g key={row.name}>
              {rowValues.map((v, mi) => {
                if (v == null) return null;
                const barH = (v / niceMax) * innerH;
                const x = groupX + mi * (barWidth + barGap);
                const y = height - padding.bottom - Math.max(barH, 1);
                return (
                  <rect
                    key={mi}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barH, 1)}
                    rx={3}
                    fill={movieColorHex(mi)}
                  />
                );
              })}
              <text
                x={groupX + groupInnerWidth / 2}
                y={height - padding.bottom + 18}
                textAnchor="middle"
                fontSize={11}
                fill="rgba(255,255,255,0.38)"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">{table.nameColumn || 'Row'}</th>
            {movies.map((m) => (
              <th key={m.slug} scope="col">
                {m.details.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              {row.valuesByColumn[column].map((v, i) => (
                <td key={i}>{v ?? 'N/A'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
