import { formatAtp, formatGross, formatInt, formatOccupancy } from '@/lib/analytics/format';
import type { Metrics } from '@/lib/analytics/types';
import { occupancyColorClass } from '@/lib/tableFormat';

export type MetricsTableRow = { key: string; name: string; sub?: string | null; metrics: Metrics; extra?: Record<string, string> };

type Col = { key: keyof Metrics; label: string; fmt: (v: number | null) => string; money?: boolean; occ?: boolean };

const COLUMNS: Col[] = [
  { key: 'gross', label: 'Gross', fmt: formatGross, money: true },
  { key: 'tickets', label: 'Tickets', fmt: formatInt },
  { key: 'shows', label: 'Shows', fmt: formatInt },
  { key: 'occupancy', label: 'Occ %', fmt: formatOccupancy, occ: true },
  { key: 'atp', label: 'ATP', fmt: formatAtp },
  { key: 'ff', label: 'FF', fmt: formatInt },
  { key: 'hf', label: 'HF', fmt: formatInt },
  { key: 'venues', label: 'Venues', fmt: formatInt },
  { key: 'cities', label: 'Cities', fmt: formatInt },
  { key: 'picGross', label: 'PIC Gross', fmt: formatGross }
];

// One table style for every Fyre Analytics breakdown. Columns whose value
// is unavailable (null) for every row are hidden rather than shown as dashes.
export default function MetricsTable({
  rows,
  nameHeader,
  subHeader,
  extraHeaders = [],
  totalRow
}: {
  rows: MetricsTableRow[];
  nameHeader: string;
  subHeader?: string;
  extraHeaders?: string[];
  totalRow?: MetricsTableRow | null;
}) {
  const cols = COLUMNS.filter((c) => rows.some((r) => r.metrics[c.key] != null));
  const showSub = !!subHeader && rows.some((r) => r.sub);
  const all = totalRow ? [...rows, totalRow] : rows;
  return (
    <div className="overflow-x-auto -mx-1 rounded-xl border border-border">
      <table className="w-full text-xs border-collapse min-w-[560px]">
        <thead>
          <tr className="bg-white/[0.03] border-b-2 border-gold">
            <th className="text-left mdtype-overline py-2.5 px-3 whitespace-nowrap text-textFaint">{nameHeader}</th>
            {showSub && <th className="text-left mdtype-overline py-2.5 px-3 whitespace-nowrap text-textFaint">{subHeader}</th>}
            {cols.map((c) => (
              <th key={c.key} className="text-right mdtype-overline py-2.5 px-3 whitespace-nowrap text-textFaint">
                {c.label}
              </th>
            ))}
            {extraHeaders.map((h) => (
              <th key={h} className="text-right mdtype-overline py-2.5 px-3 whitespace-nowrap text-textFaint">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {all.map((r, i) => {
            const isTotal = r === totalRow;
            return (
              <tr
                key={r.key}
                className={
                  isTotal
                    ? 'bg-gold/[0.06] border-t-2 border-gold/20 font-bold'
                    : `border-b border-border last:border-b-0 hover:bg-white/[0.03] transition ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`
                }
              >
                <td className="py-2.5 px-3 text-text font-semibold max-w-[280px] truncate" title={r.name}>
                  {r.name}
                </td>
                {showSub && (
                  <td className="py-2.5 px-3 text-textDim max-w-[260px] truncate" title={r.sub ?? ''}>
                    {r.sub ?? ''}
                  </td>
                )}
                {cols.map((c) => {
                  const v = r.metrics[c.key] as number | null;
                  const text = c.fmt(v);
                  return (
                    <td
                      key={c.key}
                      className={`py-2.5 px-3 text-right whitespace-nowrap tabular-nums ${
                        c.money ? 'font-stat font-bold text-[13px] text-gold' : c.occ ? `font-stat font-bold ${occupancyColorClass(text)}` : 'text-textDim'
                      }`}
                    >
                      {text}
                    </td>
                  );
                })}
                {extraHeaders.map((h) => (
                  <td key={h} className="py-2.5 px-3 text-right text-textDim whitespace-nowrap">
                    {r.extra?.[h] ?? ''}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
