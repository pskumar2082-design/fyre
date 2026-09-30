'use client';

import { useEffect, useMemo, useState } from 'react';
import MetricsTable, { type MetricsTableRow } from './MetricsTable';
import { formatDate } from '@/lib/bfilmy/adapter';
import { formatInt, formatMoney, formatUsdAtp } from '@/lib/analytics/format';
import { sumMetrics } from '@/lib/analytics/metrics';
import type { Breakdown, Dimension, MovieAnalytics, Selection } from '@/lib/analytics/types';
import type { ShowList } from '@/lib/analytics/shows';

type Tab = 'daywise' | Dimension | 'shows';

const TABS: { key: Tab; label: string }[] = [
  { key: 'daywise', label: 'Day-wise' },
  { key: 'state', label: 'State' },
  { key: 'city', label: 'City' },
  { key: 'language', label: 'Language' },
  { key: 'language_state', label: 'Language × State' },
  { key: 'language_city', label: 'Language × City' },
  { key: 'format', label: 'Format' },
  { key: 'chain', label: 'Chain' },
  { key: 'venue', label: 'Venue' },
  { key: 'pic', label: 'PIC' },
  { key: 'pic_state', label: 'PIC · State' },
  { key: 'pic_city', label: 'PIC · City' },
  { key: 'time_slot', label: 'Time slot' },
  { key: 'show_hour', label: 'Hourly' },
  { key: 'price_band', label: 'Ticket price' },
  { key: 'shows', label: 'Shows' }
];

// USA feed: only the dimensions it actually has.
const US_TABS: { key: Tab; label: string }[] = [
  { key: 'daywise', label: 'Day-wise' },
  { key: 'state', label: 'State' },
  { key: 'city', label: 'City' },
  { key: 'theater', label: 'Theater' },
  { key: 'chain', label: 'Chain' },
  { key: 'format', label: 'Format' },
  { key: 'language', label: 'Language' },
  { key: 'format_language', label: 'Format × Language' },
  { key: 'shows', label: 'Shows' }
];

const NAME_HEADERS: Partial<Record<Tab, [string, string?]>> = {
  state: ['State'],
  city: ['City', 'State'],
  language: ['Language'],
  language_state: ['State', 'Language'],
  language_city: ['City', 'Language · State'],
  format: ['Format'],
  chain: ['Chain'],
  venue: ['Venue', 'Location'],
  pic: ['Chain'],
  pic_state: ['State'],
  pic_city: ['City', 'State'],
  time_slot: ['Time slot'],
  show_hour: ['Shows starting by'],
  price_band: ['Avg ticket price'],
  theater: ['Theater', 'Location'],
  format_language: ['Language', 'Format']
};

function selectionQuery(s: Selection): string {
  return s.basis === 'lifetime' ? 'basis=lifetime' : `basis=${s.basis}&day=${s.day}`;
}

export default function MovieBreakdownExplorer({ m, initial }: { m: MovieAnalytics; initial?: { basis: 'day' | 'advance'; day: number } }) {
  const us = m.territory === 'US';
  const currency = m.currency ?? 'INR';
  const tq = us ? '&territory=us' : '';
  const tabs = us ? US_TABS : TABS;
  const releaseDays = useMemo(() => m.days.filter((d) => d.day != null).sort((a, b) => a.day! - b.day!), [m.days]);
  const advanceDays = useMemo(() => m.advance.filter((d) => d.day != null).sort((a, b) => a.day! - b.day!), [m.advance]);
  const latestDay = releaseDays[releaseDays.length - 1]?.day ?? null;

  const [basis, setBasis] = useState<Selection['basis']>(initial?.basis ?? (latestDay != null ? 'day' : m.days.length ? 'lifetime' : 'advance'));
  const [day, setDay] = useState<number>(initial?.day ?? latestDay ?? advanceDays[0]?.day ?? 1);
  const [tab, setTab] = useState<Tab>(m.days.length ? 'state' : 'state');
  const [limit, setLimit] = useState<number | 'all'>(25);
  const [data, setData] = useState<Breakdown | null>(null);
  const [shows, setShows] = useState<ShowList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selection: Selection = basis === 'lifetime' ? { basis } : { basis, day };
  const dayOptions = basis === 'advance' ? advanceDays : releaseDays;
  const singleDate =
    basis === 'day' ? releaseDays.find((d) => d.day === day)?.date : basis === 'advance' ? advanceDays.find((d) => d.day === day)?.date : undefined;

  useEffect(() => {
    if (basis !== 'lifetime' && !dayOptions.some((d) => d.day === day) && dayOptions.length) setDay(dayOptions[dayOptions.length - 1].day!);
  }, [basis]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setError(null);
    if (tab === 'daywise') return;
    const ctrl = new AbortController();
    setLoading(true);
    const url =
      tab === 'shows'
        ? singleDate
          ? `/api/analytics/shows?slug=${encodeURIComponent(m.slug)}&date=${singleDate}${basis === 'advance' ? '&kind=advance' : ''}${tq}`
          : null
        : `/api/analytics/breakdown?slug=${encodeURIComponent(m.slug)}&${selectionQuery(selection)}&dimension=${tab}${tq}`;
    if (!url) {
      setLoading(false);
      setShows(null);
      return;
    }
    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        if (tab === 'shows') setShows(j as ShowList);
        else setData(j as Breakdown);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message || 'Could not load');
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [tab, basis, day, m.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = 'text-sm bg-surface border border-border rounded-full h-10 px-4 text-text hover:border-gold/30 transition';

  let body: React.ReactNode = null;
  if (tab === 'daywise') {
    let running = [] as MovieAnalytics['days'][number]['metrics'][];
    const rows: MetricsTableRow[] = m.days.map((d) => {
      running = [...running, d.metrics];
      return {
        key: d.date,
        name: d.label,
        sub: `${formatDate(d.date)}${d.final ? '' : ' · live'}`,
        metrics: d.metrics,
        extra: { Cumulative: formatMoney(sumMetrics(running).gross, currency) }
      };
    });
    const total = m.days.length > 1 ? { key: 'total', name: 'TOTAL', sub: '', metrics: { ...sumMetrics(m.days.map((d) => d.metrics)), venues: m.lifetime.venues, cities: m.lifetime.cities, states: m.lifetime.states } } : null;
    body = rows.length ? (
      <MetricsTable rows={rows} nameHeader="Day" subHeader="Date" extraHeaders={['Cumulative']} totalRow={total} currency={currency} showSeats={us} />
    ) : (
      <Empty text="No box office tracked yet." />
    );
  } else if (tab === 'shows') {
    if (!singleDate) body = <Empty text="Pick a single day (Day N or Advance) to see individual shows." />;
    else if (loading && !shows) body = <Empty text="Loading shows…" />;
    else if (shows && !shows.available) body = <Empty text={shows.reason ?? 'Not available.'} />;
    else if (shows) {
      const list = limit === 'all' ? shows.rows : shows.rows.slice(0, limit);
      body = (
        <>
          <MetricsTable
            currency={currency}
            nameHeader={us ? 'Theater' : 'Venue'}
            subHeader="City"
            extraHeaders={us ? ['Time', 'Language', 'Format', 'Chain', 'Seats', 'Sold', 'Available', 'Price'] : ['Time', 'Version', 'Seats', 'Sold']}
            rows={list.map((s, i) => ({
              key: `${i}`,
              name: s.venue,
              sub: `${s.city}, ${s.state}`,
              metrics: { gross: s.gross, tickets: s.sold, shows: 1, seats: s.seats, occupancy: s.occupancy, atp: s.sold > 0 ? s.gross / s.sold : null, ff: null, hf: null, venues: null, cities: null, states: null, picGross: null, picTickets: null },
              extra: (us
                ? {
                    Time: s.time,
                    Language: s.language,
                    Format: s.format,
                    Chain: s.chain ?? '',
                    Seats: s.seats > 0 ? s.seats.toLocaleString('en-US') : 'N/A',
                    Sold: s.sold.toLocaleString('en-US'),
                    Available: s.available == null ? 'N/A' : s.available.toLocaleString('en-US'),
                    Price: formatUsdAtp(s.price ?? null)
                  }
                : { Time: s.time, Version: `${s.language} ${s.format}`, Seats: formatInt(s.seats), Sold: formatInt(s.sold) }) as Record<string, string>
            }))}
          />
          <Foot
            count={list.length}
            total={shows.rows.length}
            limit={limit}
            setLimit={setLimit}
            note={`${(shows as ShowList & { total?: number }).total ?? shows.rows.length} shows, highest gross first${(shows as any).total > shows.rows.length ? ` (top ${shows.rows.length} listed)` : ''}${shows.source === 'live' ? ` · live ${shows.sourceUpdated ?? ''}` : ''}`}
          />
        </>
      );
    }
  } else if (error) body = <Empty text={error} />;
  else if (!data || (loading && data.dimension !== tab)) body = <Empty text="Loading…" />;
  else if (!data.available) body = <Empty text={data.reason ?? 'Not available for this selection.'} />;
  else {
    const [nameHeader, subHeader] = NAME_HEADERS[tab] ?? ['Name'];
    const rows = limit === 'all' ? data.rows : data.rows.slice(0, limit);
    const tableRows: MetricsTableRow[] = rows.map((r) =>
      tab === 'show_hour' && r.cumulative
        ? { key: r.key, name: r.name, sub: r.sub, metrics: r.cumulative, extra: { 'This hour': formatMoney(r.metrics.gross, currency), 'Shows this hour': formatInt(r.metrics.shows) } }
        : { key: r.key, name: r.name, sub: r.sub, metrics: r.metrics }
    );
    body = (
      <>
        <MetricsTable
          rows={tableRows}
          nameHeader={nameHeader}
          subHeader={subHeader}
          extraHeaders={tab === 'show_hour' ? ['This hour', 'Shows this hour'] : []}
          currency={currency}
          showSeats={us}
          totalRow={data.totalRow?.metrics ? { key: '__total', name: data.totalRow.label, sub: '', metrics: data.totalRow.metrics } : null}
          totalStatus={data.totalRow?.status}
          totalNote={data.totalRow?.note}
          totalLabel={data.totalRow?.label}
          occupancyPartial={data.totalRow?.occupancyCoverage === 'PARTIAL'}
        />
        <Foot
          count={rows.length}
          total={data.rows.length}
          limit={limit}
          setLimit={setLimit}
          note={tab === 'show_hour' ? 'Running totals by show start time.' : data.source === 'summary' ? 'From the daily summary file (show-level detail not available for every date).' : null}
        />
      </>
    );
  }

  const noDays = basis !== 'lifetime' && dayOptions.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <select className={select} value={basis} onChange={(e) => setBasis(e.target.value as Selection['basis'])} aria-label="Basis">
          {releaseDays.length > 0 && <option value="day">Tracked day</option>}
          {releaseDays.length > 0 && <option value="cumulative">Cumulative through day</option>}
          {m.days.length > 0 && <option value="lifetime">{m.carriedOver ? 'Tracked since 1 Jan 2025' : 'Lifetime'}</option>}
          {advanceDays.length > 0 && <option value="advance">Advance booking</option>}
        </select>
        {basis !== 'lifetime' && !noDays && (
          <select className={select} value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Day">
            {dayOptions.map((d) => (
              <option key={d.date} value={d.day!}>
                {d.label} · {formatDate(d.date)}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap text-xs font-semibold px-3.5 py-2 rounded-full border transition ${
              tab === t.key ? 'bg-gold/[0.12] border-gold/40 text-gold' : 'border-border text-textDim hover:text-text hover:border-gold/30'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {noDays ? <Empty text="No days to show for this basis." /> : body}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-textFaint">{text}</div>;
}

function Foot({ count, total, limit, setLimit, note }: { count: number; total: number; limit: number | 'all'; setLimit: (l: number | 'all') => void; note: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px] text-textFaint">
      <span>
        Showing {count} of {total}
        {note ? ` · ${note}` : ''}
      </span>
      {total > 25 && (
        <button type="button" className="text-gold font-semibold hover:text-goldBright" onClick={() => setLimit(limit === 'all' ? 25 : 'all')}>
          {limit === 'all' ? 'Show top 25' : `Show all ${total}`}
        </button>
      )}
    </div>
  );
}
