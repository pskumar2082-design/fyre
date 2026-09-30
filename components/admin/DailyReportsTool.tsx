'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui';
import { formatMetric, formatOccupancy, USA_LABEL } from '@/lib/analytics/format';
import type { Currency, MetricKey, Metrics, MovieAnalytics } from '@/lib/analytics/types';
import MovieBreakdownExplorer from '@/components/analytics/MovieBreakdownExplorer';

// Admin → Daily Reports. One date, India (IST date) and/or USA (US report
// date). Numbers come from /api/admin/daily-report (same stored figures as
// the public pages). INR and USD are never combined.

type Row = { slug: string; title: string; day: number | null; metrics: Metrics; lastUpdated: string | null; extra?: Record<string, any> };
type Report = { territory: 'IN' | 'US'; currency: Currency; date: string; kind: string; rows: Row[]; total: Metrics | null; totalNote: string };

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

const yesterday = () => new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const IN_COLS: { key: MetricKey; label: string; detailed?: boolean }[] = [
  { key: 'gross', label: 'Gross' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'shows', label: 'Shows' },
  { key: 'venues', label: 'Venues' },
  { key: 'cities', label: 'Cities' },
  { key: 'states', label: 'States' },
  { key: 'occupancy', label: 'Occ %' },
  { key: 'atp', label: 'ATP' },
  { key: 'ff', label: 'FF' },
  { key: 'hf', label: 'HF' },
  { key: 'picGross', label: 'PIC Gross' },
  { key: 'picTickets', label: 'PIC Tickets' },
  { key: 'seats', label: 'Seats', detailed: true }
];
const US_COLS: { key: MetricKey; label: string; detailed?: boolean }[] = [
  { key: 'gross', label: 'Gross $' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'shows', label: 'Shows' },
  { key: 'venues', label: 'Theatres' },
  { key: 'cities', label: 'Cities' },
  { key: 'states', label: 'States' },
  { key: 'occupancy', label: 'Occ %' },
  { key: 'atp', label: 'ATP' },
  { key: 'seats', label: 'Seats', detailed: true }
];

export default function DailyReportsTool() {
  const [date, setDate] = useState(yesterday());
  const [territory, setTerritory] = useState<'in' | 'us' | 'both'>('both');
  const [kind, setKind] = useState<'boxoffice' | 'advance'>('boxoffice');
  const [movie, setMovie] = useState('');
  const [view, setView] = useState<'summary' | 'detailed'>('summary');
  const [data, setData] = useState<{ india: Report | null; usa: Report | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<{ slug: string; territory: 'IN' | 'US'; day: number | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await fetch(`/api/admin/daily-report?date=${date}&territory=${territory}&kind=${kind}`, { headers: await authHeader() });
      const j = await res.json();
      if (cancelled) return;
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setData(j);
    })()
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, territory, kind]);

  const movies = useMemo(() => {
    const all = [...(data?.india?.rows ?? []), ...(data?.usa?.rows ?? [])];
    return [...new Map(all.map((r) => [r.slug, r.title])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const pill = (on: boolean) => `text-xs font-semibold px-3 py-1.5 rounded-full border ${on ? 'bg-gold/[0.12] border-gold/40 text-gold' : 'border-border text-textDim'}`;
  const filter = (r: Report | null) => (r ? { ...r, rows: movie ? r.rows.filter((x) => x.slug === movie) : r.rows } : null);
  const india = filter(data?.india ?? null);
  const usa = filter(data?.usa ?? null);

  return (
    <div>
      <Card className="p-4 mb-5 flex flex-wrap items-end gap-4">
        <label className="text-xs text-textFaint flex flex-col gap-1">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
        </label>
        <div>
          <div className="text-xs text-textFaint mb-1">Territory</div>
          <div className="flex gap-1.5">
            {(['in', 'us', 'both'] as const).map((t) => (
              <button key={t} type="button" className={pill(territory === t)} onClick={() => setTerritory(t)}>
                {t === 'in' ? 'India' : t === 'us' ? 'USA' : 'Both'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-textFaint mb-1">Report</div>
          <div className="flex gap-1.5">
            <button type="button" className={pill(kind === 'boxoffice')} onClick={() => setKind('boxoffice')}>
              Box office
            </button>
            <button type="button" className={pill(kind === 'advance')} onClick={() => setKind('advance')}>
              Advance
            </button>
          </div>
        </div>
        <div>
          <div className="text-xs text-textFaint mb-1">View</div>
          <div className="flex gap-1.5">
            <button type="button" className={pill(view === 'summary')} onClick={() => setView('summary')}>
              Summary
            </button>
            <button type="button" className={pill(view === 'detailed')} onClick={() => setView('detailed')}>
              Detailed
            </button>
          </div>
        </div>
        <label className="text-xs text-textFaint flex flex-col gap-1">
          Movie
          <select value={movie} onChange={(e) => setMovie(e.target.value)} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text max-w-[220px]">
            <option value="">All tracked movies</option>
            {movies.map(([slug, title]) => (
              <option key={slug} value={slug}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </Card>

      {error && <div className="text-red text-sm mb-4">{error}</div>}
      {loading && <div className="text-xs text-textFaint mb-3">Loading…</div>}

      {territory === 'both' && india && usa ? (
        <BothView india={india} usa={usa} onOpen={setOpen} />
      ) : (
        <>
          {india && <ReportTable r={india} title={`India · ${date} (IST)`} cols={IN_COLS} view={view} onOpen={(slug, day) => setOpen({ slug, territory: 'IN', day })} />}
          {usa && <ReportTable r={usa} title={`${USA_LABEL} · ${date} (US report date)`} cols={US_COLS} view={view} onOpen={(slug, day) => setOpen({ slug, territory: 'US', day })} />}
        </>
      )}

      {open && <Drilldown key={`${open.slug}:${open.territory}:${open.day}:${kind}`} open={open} kind={kind} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ReportTable({
  r,
  title,
  cols,
  view,
  onOpen
}: {
  r: Report;
  title: string;
  cols: { key: MetricKey; label: string; detailed?: boolean }[];
  view: 'summary' | 'detailed';
  onOpen: (slug: string, day: number | null) => void;
}) {
  const shown = cols.filter((c) => view === 'detailed' || !c.detailed);
  const us = r.currency === 'USD';
  const f = (k: MetricKey, v: number | null | undefined) => (k === 'occupancy' ? formatOccupancy(v ?? null) : formatMetric(k, v ?? null, r.currency));
  return (
    <Card className="p-4 mb-6">
      <div className="mdtype-overline text-gold mb-3">{title}</div>
      {r.rows.length === 0 ? (
        <div className="text-sm text-textFaint py-6">No tracked movies with {r.kind === 'advance' ? 'advance' : 'box office'} on this date.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-white/[0.03] border-b-2 border-gold">
                <th className="text-left mdtype-overline py-2 px-3 text-textFaint">Movie</th>
                <th className="text-left mdtype-overline py-2 px-3 text-textFaint">Day</th>
                {shown.map((c) => (
                  <th key={c.key} className="text-right mdtype-overline py-2 px-3 text-textFaint whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
                {view === 'detailed' && us && <th className="text-right mdtype-overline py-2 px-3 text-textFaint">Source shows / occ</th>}
                <th className="text-right mdtype-overline py-2 px-3 text-textFaint">Last updated</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.slug} className="border-b border-border hover:bg-white/[0.03] cursor-pointer" onClick={() => onOpen(row.slug, row.day)}>
                  <td className="py-2 px-3 text-text font-semibold whitespace-nowrap">{row.title}</td>
                  <td className="py-2 px-3 text-textDim">{row.day == null ? '—' : row.day === 0 ? (us ? 'Day 0 (Premieres)' : 'Day 0') : `Day ${row.day}`}</td>
                  {shown.map((c) => (
                    <td key={c.key} className={`py-2 px-3 text-right tabular-nums whitespace-nowrap ${c.key === 'gross' ? 'text-gold font-bold' : 'text-textDim'}`}>
                      {row.metrics[c.key] == null ? 'N/A' : f(c.key, row.metrics[c.key] as number)}
                    </td>
                  ))}
                  {view === 'detailed' && us && (
                    <td className="py-2 px-3 text-right text-textFaint whitespace-nowrap">
                      {row.extra?.showsSource ?? '—'}
                      {row.extra?.showsStatus === 'MISMATCH' ? ' ≠ rows' : ''} / {row.extra?.occupancySource != null ? `${Number(row.extra.occupancySource).toFixed(2)}%` : '—'}
                      {row.extra?.zeroSeatShows ? ` · ${row.extra.zeroSeatShows} no-seat` : ''}
                    </td>
                  )}
                  <td className="py-2 px-3 text-right text-textFaint whitespace-nowrap">{row.lastUpdated ?? '—'}</td>
                </tr>
              ))}
            </tbody>
            {r.total && (
              <tfoot>
                <tr className="bg-gold/[0.08] border-t-2 border-gold/40 font-bold">
                  <td className="py-2.5 px-3 text-gold tracking-wide">GRAND TOTAL</td>
                  <td className="py-2.5 px-3 text-textFaint">{r.rows.length} movies</td>
                  {shown.map((c) => (
                    <td key={c.key} className={`py-2.5 px-3 text-right tabular-nums whitespace-nowrap ${c.key === 'gross' ? 'text-gold' : 'text-text'}`}>
                      {r.total![c.key] == null ? 'N/A' : f(c.key, r.total![c.key] as number)}
                    </td>
                  ))}
                  {view === 'detailed' && us && <td />}
                  <td />
                </tr>
                <tr>
                  <td colSpan={shown.length + 4} className="px-3 py-2 text-[11px] text-textFaint">
                    Additive figures are summed (N/A where any movie lacks one); occupancy = total tickets ÷ total seats; ATP = total gross ÷ total tickets. {r.totalNote}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Card>
  );
}

function BothView({ india, usa, onOpen }: { india: Report; usa: Report; onOpen: (o: { slug: string; territory: 'IN' | 'US'; day: number | null }) => void }) {
  const slugs = [...new Set([...india.rows.map((r) => r.slug), ...usa.rows.map((r) => r.slug)])];
  const byIn = new Map(india.rows.map((r) => [r.slug, r]));
  const byUs = new Map(usa.rows.map((r) => [r.slug, r]));
  const metric = (r: Row | undefined, k: MetricKey, cur: Currency) => (!r ? '—' : r.metrics[k] == null ? 'N/A' : k === 'occupancy' ? formatOccupancy(r.metrics[k] as number) : formatMetric(k, r.metrics[k] as number, cur));
  const keys: MetricKey[] = ['gross', 'tickets', 'shows', 'occupancy', 'atp'];
  return (
    <div className="grid gap-3">
      <div className="text-[11px] text-textFaint">India uses the IST date, USA the US report date. {USA_LABEL}. INR and USD are never added.</div>
      {slugs
        .sort((a, b) => (byIn.get(b)?.metrics.gross ?? 0) - (byIn.get(a)?.metrics.gross ?? 0))
        .map((slug) => {
          const a = byIn.get(slug);
          const b = byUs.get(slug);
          return (
            <Card key={slug} className="p-4">
              <div className="font-semibold text-text mb-2">{a?.title ?? b?.title}</div>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-x-4 gap-y-1 text-sm">
                <button type="button" disabled={!a} className="text-left mdtype-overline text-gold disabled:opacity-40" onClick={() => a && onOpen({ slug, territory: 'IN', day: a.day })}>
                  India{a?.day != null ? ` · Day ${a.day}` : ''}
                </button>
                <span />
                <button type="button" disabled={!b} className="text-right mdtype-overline text-gold disabled:opacity-40" onClick={() => b && onOpen({ slug, territory: 'US', day: b.day })}>
                  USA{b?.day != null ? ` · Day ${b.day}` : ''}
                </button>
                {keys.map((k) => (
                  <div key={k} className="contents">
                    <span className={`tabular-nums ${k === 'gross' ? 'text-gold font-bold' : 'text-text'}`}>{metric(a, k, 'INR')}</span>
                    <span className="text-textFaint text-xs text-center">{k === 'occupancy' ? 'Occupancy' : k === 'atp' ? 'ATP' : k[0].toUpperCase() + k.slice(1)}</span>
                    <span className={`tabular-nums text-right ${k === 'gross' ? 'text-gold font-bold' : 'text-text'}`}>{metric(b, k, 'USD')}</span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
    </div>
  );
}

function Drilldown({ open, kind, onClose }: { open: { slug: string; territory: 'IN' | 'US'; day: number | null }; kind: 'boxoffice' | 'advance'; onClose: () => void }) {
  const [m, setM] = useState<MovieAnalytics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/analytics/movie/${encodeURIComponent(open.slug)}${open.territory === 'US' ? '?territory=us' : ''}`)
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(j.error) : setM(j)))
      .catch((e) => setErr(e.message));
  }, [open.slug, open.territory]);
  return (
    <Card className="p-4 mt-6">
      <div className="flex justify-between items-center mb-3">
        <div className="mdtype-overline text-gold">
          {m?.title ?? open.slug} · {open.territory === 'US' ? USA_LABEL : 'India'}
        </div>
        <button type="button" className="text-xs text-textFaint border border-border rounded-full px-3 py-1" onClick={onClose}>
          Close
        </button>
      </div>
      {err && <div className="text-sm text-red">{err}</div>}
      {open.day == null && <div className="text-sm text-textFaint mb-2">This date has no release-day number; pick a day below.</div>}
      {m && <MovieBreakdownExplorer m={m} initial={open.day != null ? { basis: kind === 'advance' ? 'advance' : 'day', day: open.day } : undefined} />}
    </Card>
  );
}
