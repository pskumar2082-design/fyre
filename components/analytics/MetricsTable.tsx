import { formatMetric } from '@/lib/analytics/format';
import type { Currency, MetricKey, Metrics, TotalStatus } from '@/lib/analytics/types';
import { occupancyColorClass } from '@/lib/tableFormat';

export type MetricsTableRow = { key: string; name: string; sub?: string | null; metrics: Metrics; extra?: Record<string, string> };

type Col = { key: MetricKey; label: string; money?: boolean; occ?: boolean };

const columns = (currency: Currency, showSeats: boolean): Col[] => [
  { key: 'gross', label: 'Gross', money: true },
  { key: 'tickets', label: 'Tickets' },
  { key: 'shows', label: 'Shows' },
  ...(showSeats ? [{ key: 'seats' as MetricKey, label: 'Seats' }] : []),
  { key: 'occupancy', label: 'Occ %', occ: true },
  { key: 'atp', label: 'ATP' },
  { key: 'ff', label: 'FF' },
  { key: 'hf', label: 'HF' },
  { key: 'venues', label: currency === 'USD' ? 'Theatres' : 'Venues' },
  { key: 'cities', label: 'Cities' },
  { key: 'picGross', label: 'PIC Gross', money: false }
];

const STATUS_STYLE: Record<TotalStatus, string> = {
  MATCH: 'border-emerald-400/40 text-emerald-300 bg-emerald-400/10',
  MISMATCH: 'border-amber-400/40 text-amber-300 bg-amber-400/10',
  PARTIAL: 'border-sky-400/40 text-sky-300 bg-sky-400/10'
};
const STATUS_TEXT: Record<TotalStatus, string> = { MATCH: 'Matches headline', MISMATCH: 'Differs from headline', PARTIAL: 'Partial coverage' };

// One table style for every Fyre Analytics breakdown. Columns whose value
// is unavailable (null) for every row are hidden rather than shown as
// dashes. The TOTAL row is set apart (it is the selection's total, not
// another row) and carries its reconciliation status.
export default function MetricsTable({
  rows,
  nameHeader,
  subHeader,
  extraHeaders = [],
  totalRow,
  totalStatus,
  totalNote,
  totalLabel = 'TOTAL',
  occupancyPartial,
  currency = 'INR',
  showSeats = false
}: {
  rows: MetricsTableRow[];
  nameHeader: string;
  subHeader?: string;
  extraHeaders?: string[];
  totalRow?: MetricsTableRow | null;
  totalStatus?: TotalStatus;
  totalNote?: string | null;
  totalLabel?: string;
  occupancyPartial?: boolean;
  currency?: Currency;
  showSeats?: boolean;
}) {
  const cols = columns(currency, showSeats).filter((c) => rows.some((r) => r.metrics[c.key] != null));
  const showSub = !!subHeader && rows.some((r) => r.sub);
  const span = 1 + (showSub ? 1 : 0) + cols.length + extraHeaders.length;
  const partialOnly = totalStatus === 'PARTIAL' && !totalRow;
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
          {rows.map((r, i) => (
            <tr key={r.key} className={`border-b border-border last:border-b-0 hover:bg-white/[0.03] transition ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}>
              <Cells r={r} cols={cols} showSub={showSub} extraHeaders={extraHeaders} currency={currency} />
            </tr>
          ))}
        </tbody>
        {(totalRow || partialOnly) && (
          <tfoot>
            {totalRow && (
              <tr className="bg-gold/[0.08] border-t-2 border-gold/40 font-bold">
                <Cells r={totalRow} cols={cols} showSub={showSub} extraHeaders={extraHeaders} currency={currency} total occPartial={occupancyPartial} />
              </tr>
            )}
            {partialOnly && (
              <tr className="bg-gold/[0.05] border-t-2 border-gold/30">
                <td className="py-2.5 px-3 font-bold text-text tracking-wide whitespace-nowrap">{totalLabel}</td>
                <td className="py-2.5 px-3 text-textDim" colSpan={span - 1}>
                  Partial coverage — no total shown.
                </td>
              </tr>
            )}
            {totalStatus && (
              <tr>
                <td colSpan={span} className="px-3 py-2 text-[11px] text-textFaint">
                  <span className={`inline-block mr-2 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${STATUS_STYLE[totalStatus]}`}>{STATUS_TEXT[totalStatus]}</span>
                  {totalNote ?? (totalStatus === 'MATCH' ? 'Every row added up equals the headline for this selection.' : '')}
                  {occupancyPartial ? ' Occupancy excludes shows with no seat count.' : ''}
                </td>
              </tr>
            )}
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Cells({
  r,
  cols,
  showSub,
  extraHeaders,
  currency,
  total,
  occPartial
}: {
  r: MetricsTableRow;
  cols: Col[];
  showSub: boolean;
  extraHeaders: string[];
  currency: Currency;
  total?: boolean;
  occPartial?: boolean;
}) {
  return (
    <>
      <td className={`py-2.5 px-3 font-semibold max-w-[280px] truncate ${total ? 'text-gold tracking-wide' : 'text-text'}`} title={r.name}>
        {r.name}
      </td>
      {showSub && (
        <td className="py-2.5 px-3 text-textDim max-w-[260px] truncate" title={r.sub ?? ''}>
          {r.sub ?? ''}
        </td>
      )}
      {cols.map((c) => {
        const v = r.metrics[c.key] as number | null;
        const text = v == null && total ? 'N/A' : formatMetric(c.key, v, currency);
        return (
          <td
            key={c.key}
            className={`py-2.5 px-3 text-right whitespace-nowrap tabular-nums ${
              c.money ? 'font-stat font-bold text-[13px] text-gold' : c.occ ? `font-stat font-bold ${occupancyColorClass(text)}` : total ? 'text-text' : 'text-textDim'
            }`}
          >
            {text}
            {total && c.occ && occPartial ? '*' : ''}
          </td>
        );
      })}
      {extraHeaders.map((h) => (
        <td key={h} className="py-2.5 px-3 text-right text-textDim whitespace-nowrap">
          {r.extra?.[h] ?? ''}
        </td>
      ))}
    </>
  );
}
