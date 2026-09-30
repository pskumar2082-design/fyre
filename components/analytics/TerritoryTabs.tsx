'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Card } from '@/components/ui';
import SummaryCards from './SummaryCards';
import MovieBreakdownExplorer from './MovieBreakdownExplorer';
import { formatDate } from '@/lib/bfilmy/adapter';
import { formatMetric, formatMoney, formatOccupancy, USA_LABEL } from '@/lib/analytics/format';
import type { MetricKey, MovieAnalytics } from '@/lib/analytics/types';

type Tab = 'overview' | 'india' | 'usa';

// One Fyre movie, two territories: [ Overview ] [ India ] [ USA ].
// India and USA figures sit side by side; INR and USD are never added.
export default function TerritoryTabs({ india, usa }: { india: MovieAnalytics; usa: MovieAnalytics | null }) {
  const [tab, setTab] = useState<Tab>(usa ? 'overview' : 'india');
  useEffect(() => {
    const h = window.location.hash.replace('#', '');
    if (usa && (h === 'usa' || h === 'overview' || h === 'india')) setTab(h as Tab);
  }, [usa]);
  const pick = (t: Tab) => {
    setTab(t);
    history.replaceState(null, '', `#${t}`);
  };

  const explorer = (m: MovieAnalytics) => (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-gold" />
        <h2 className="hdisplay text-lg">Performance breakdown{m.territory === 'US' ? ` · ${USA_LABEL}` : ''}</h2>
      </div>
      <Card className="p-4 sm:p-5">
        <MovieBreakdownExplorer key={m.territory ?? 'IN'} m={m} />
      </Card>
    </div>
  );

  if (!usa) {
    return (
      <>
        <SummaryCards m={india} />
        {explorer(india)}
      </>
    );
  }

  const btn = (t: Tab, label: string) => (
    <button
      key={t}
      type="button"
      onClick={() => pick(t)}
      className={`whitespace-nowrap text-sm font-semibold px-4 py-2 rounded-full border transition ${
        tab === t ? 'bg-gold/[0.12] border-gold/40 text-gold' : 'border-border text-textDim hover:text-text hover:border-gold/30'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto" role="tablist" aria-label="Territory">
        {btn('overview', 'Overview')}
        {btn('india', 'India')}
        {btn('usa', 'USA')}
      </div>
      {tab === 'overview' && <Overview india={india} usa={usa} />}
      {tab === 'india' && (
        <>
          <SummaryCards m={india} />
          {explorer(india)}
        </>
      )}
      {tab === 'usa' && (
        <>
          <p className="text-textFaint text-xs mb-3">
            {USA_LABEL}: shows of Indian-language films tracked in the USA — not total US theatrical box office. Amounts in US dollars.
          </p>
          <SummaryCards m={usa} />
          <UsaAdvance m={usa} />
          {explorer(usa)}
        </>
      )}
    </div>
  );
}

const ROWS: { key: MetricKey; label: string }[] = [
  { key: 'gross', label: 'Gross' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'shows', label: 'Shows' },
  { key: 'occupancy', label: 'Occupancy' },
  { key: 'atp', label: 'ATP' },
  { key: 'venues', label: 'Venues / Theatres' },
  { key: 'states', label: 'States' }
];

function Column({ m, title, subtitle }: { m: MovieAnalytics; title: string; subtitle: string }) {
  const cur = m.currency ?? 'INR';
  const lt = m.lifetime;
  const has = m.days.length > 0;
  const latest = m.latestDay;
  return (
    <Card className="p-5">
      <div className="mdtype-overline text-gold">{title}</div>
      <div className="text-textFaint text-[11px] mb-4">{subtitle}</div>
      {has ? (
        <div className="space-y-3">
          {ROWS.map((r) => (
            <div key={r.key} className="flex items-baseline justify-between gap-3 border-b border-border pb-2 last:border-b-0">
              <span className="text-textDim text-sm">{r.key === 'venues' ? (cur === 'USD' ? 'Theatres' : 'Venues') : r.label}</span>
              <span className={`font-stat tabular-nums ${r.key === 'gross' ? 'text-gold font-bold text-2xl' : 'text-text font-semibold'}`}>
                {r.key === 'occupancy' ? formatOccupancy(lt.occupancy) : lt[r.key] == null ? 'N/A' : formatMetric(r.key, lt[r.key] as number, cur)}
              </span>
            </div>
          ))}
          {latest && (
            <div className="text-[11px] text-textFaint pt-1">
              Latest: {latest.label} ({formatDate(latest.date)}) {formatMoney(latest.metrics.gross, cur)}
              {latest.final ? '' : ' · live'}
            </div>
          )}
        </div>
      ) : (
        <div className="text-textFaint text-sm py-6">No box office tracked yet.</div>
      )}
    </Card>
  );
}

function Overview({ india, usa }: { india: MovieAnalytics; usa: MovieAnalytics }) {
  return (
    <div className="mb-8">
      <div className="grid sm:grid-cols-2 gap-4">
        <Column m={india} title="India" subtitle={`All languages · INR · ${india.days.length} tracked days`} />
        <Column m={usa} title={USA_LABEL} subtitle={`USD · ${usa.days.length} tracked days · not total US box office`} />
      </div>
      <p className="text-textFaint text-[11px] mt-3">Totals are per territory in their own currency; they are never added together.</p>
    </div>
  );
}

type Capture = { capturedOn: string; gross: number; tickets: number; shows: number; dodGross: number | null; dodTickets: number | null };

// Open USA advance dates with Fyre's daily captures and the DERIVED
// day-over-day change (from the day Fyre began capturing).
function UsaAdvance({ m }: { m: MovieAnalytics }) {
  const open = m.advance.filter((a) => !a.final);
  const [data, setData] = useState<Record<string, Capture[]>>({});
  useEffect(() => {
    open.forEach((a) => {
      fetch(`/api/analytics/usa-advance?slug=${encodeURIComponent(m.slug)}&date=${a.date}`)
        .then((r) => r.json())
        .then((j) => setData((d) => ({ ...d, [a.date]: j.captures ?? [] })))
        .catch(() => {});
    });
  }, [m.slug]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open.length) return null;
  return (
    <Card className="p-4 sm:p-5 mb-8">
      <div className="mdtype-overline text-textFaint mb-3">USA advance (upcoming shows) · separate from box office</div>
      <div className="space-y-2">
        {open.map((a) => {
          const caps = data[a.date] ?? [];
          const last = caps[caps.length - 1];
          return (
            <div key={a.date} className="flex flex-wrap items-baseline justify-between gap-3 text-sm border-b border-border pb-2 last:border-b-0">
              <span className="text-text font-semibold">
                {a.label} · {formatDate(a.date)}
              </span>
              <span className="font-stat text-gold font-bold">{formatMoney(a.metrics.gross, 'USD')}</span>
              <span className="text-textDim text-xs">
                {a.metrics.tickets.toLocaleString('en-US')} tickets · {a.metrics.shows.toLocaleString('en-US')} shows · {formatOccupancy(a.metrics.occupancy)}
              </span>
              <span className="text-textFaint text-[11px]">
                DoD (Fyre-derived):{' '}
                {last && last.dodGross != null ? `${last.dodGross >= 0 ? '+' : ''}${formatMoney(last.dodGross, 'USD')} since the previous day's capture` : 'needs two daily captures'}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
