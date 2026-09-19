'use client';

import { useMemo, useState } from 'react';

export type BreakdownRow = {
  id: string;
  breakdown_type: string; // 'state' | 'language' | 'format'
  label: string;
  day_date: string;
  gross: number;
  shows: number | null;
  tickets_sold: number | null;
  ff: number | null;
  sold_out: number | null;
  occ_pct: number | null;
};

const TYPES = ['state', 'language', 'format'] as const;

export default function BreakdownTable({ rows }: { rows: BreakdownRow[] }) {
  const [type, setType] = useState<(typeof TYPES)[number]>('state');
  const [date, setDate] = useState<string | null>(null);

  const dates = useMemo(() => {
    const set = new Set(rows.filter((r) => r.breakdown_type === type).map((r) => r.day_date));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [rows, type]);

  const activeDate = date && dates.includes(date) ? date : dates[0] ?? null;
  const visible = rows.filter((r) => r.breakdown_type === type && r.day_date === activeDate);

  if (rows.length === 0) {
    return <p className="text-textFaint text-sm">No breakdown entered yet — add rows from the admin panel.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                setDate(null);
              }}
              className={`text-xs font-semibold rounded-full px-3.5 py-1.5 border transition capitalize ${
                t === type ? 'bg-gold text-white border-gold' : 'text-textDim border-border hover:border-goldDim'
              }`}
            >
              {t} wise
            </button>
          ))}
        </div>
        {dates.length > 0 && (
          <select
            value={activeDate ?? ''}
            onChange={(e) => setDate(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs"
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-textFaint text-sm">No {type}-wise entries for this date.</p>
      ) : (
        <div className="overflow-x-auto bg-surface border border-border rounded-2xl">
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
              <tr className="text-textFaint text-xs uppercase border-b border-border bg-bgAlt/50">
                <th className="text-left py-3 px-4">{type}</th>
                <th className="text-right py-3 px-4">Gross</th>
                <th className="text-right py-3 px-4">Shows</th>
                <th className="text-right py-3 px-4">Tickets sold</th>
                <th className="text-right py-3 px-4">FF</th>
                <th className="text-right py-3 px-4">Sold out</th>
                <th className="text-right py-3 px-4">Occ %</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="py-2.5 px-4">{r.label}</td>
                  <td className="text-right py-2.5 px-4 text-goldBright font-semibold">₹{Number(r.gross).toFixed(2)} Cr</td>
                  <td className="text-right py-2.5 px-4">{r.shows ?? '—'}</td>
                  <td className="text-right py-2.5 px-4">{r.tickets_sold ?? '—'}</td>
                  <td className="text-right py-2.5 px-4">{r.ff ?? '—'}</td>
                  <td className="text-right py-2.5 px-4">{r.sold_out ?? '—'}</td>
                  <td className="text-right py-2.5 px-4">{r.occ_pct != null ? `${r.occ_pct}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
