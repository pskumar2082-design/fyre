'use client';

import { useMemo, useState } from 'react';
import { Card, Pill } from '@/components/ui';

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
            <Pill
              key={t}
              variant={t === type ? 'primary' : 'default'}
              onClick={() => {
                setType(t);
                setDate(null);
              }}
              className="capitalize"
            >
              {t} wise
            </Pill>
          ))}
        </div>
        {dates.length > 0 && (
          <select
            value={activeDate ?? ''}
            onChange={(e) => setDate(e.target.value)}
            className="bg-bg border-none rounded-lg px-3 py-2 text-xs text-text"
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
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
              <tr className="text-textFaint text-xs uppercase border-b border-border bg-bgAlt/60">
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
                <tr key={r.id} className="border-b border-[#F2F4F7] last:border-0">
                  <td className="py-2.5 px-4 font-medium">{r.label}</td>
                  <td className="text-right py-2.5 px-4 text-gold font-semibold">₹{Number(r.gross).toFixed(2)} Cr</td>
                  <td className="text-right py-2.5 px-4 text-textDim">{r.shows ?? '—'}</td>
                  <td className="text-right py-2.5 px-4 text-textDim">{r.tickets_sold ?? '—'}</td>
                  <td className="text-right py-2.5 px-4 text-textDim">{r.ff ?? '—'}</td>
                  <td className="text-right py-2.5 px-4 text-textDim">{r.sold_out ?? '—'}</td>
                  <td className="text-right py-2.5 px-4 text-textDim">{r.occ_pct != null ? `${r.occ_pct}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
