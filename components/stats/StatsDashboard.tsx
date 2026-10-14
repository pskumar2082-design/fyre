'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { formatDate } from '@/lib/bfilmy/adapter';
import { formatMetric, formatMoney, formatOccupancy } from '@/lib/analytics/format';
import { pageOf, pointsInRange, totalsOf, type MetricCard, type MovieStats, type StatsPoint } from '@/lib/analytics/statsModel';
import StatsChart from './StatsChart';
import { ChartCard, DataTable, Empty, LegendItem, Pager, Segmented, Select, Tag, type Col } from './parts';
import { AdvancePanel, ComparePanel, DistributionCard, ExplorerPanel, IndiaUsaPanel, IntradayPanel, ScenarioPanel, type RangeQuery } from './panels';
import { axisFor, fmtMetric, METRIC_NAME, pointAxisLabel, pointTooltip, shortDate, STATE_TEXT, type ChartMetric } from './fmt';

const AMBER = '#fbbf24';
const LATER = '#a1a1aa';

type Preset = 'all' | 'window' | 'last7' | 'last14' | 'custom';

// Movie Stats: the Box Office section of a movie page. Server-rendered
// figures for India and/or the USA come in as props; breakdowns, refresh
// histories and comparisons load on demand from /api/analytics/stats/*.
export default function StatsDashboard({ india, usa, releaseLabel, languages }: { india: MovieStats | null; usa: MovieStats | null; releaseLabel: string | null; languages: string[] }) {
  const [territory, setTerritory] = useState<'IN' | 'US'>(india ? 'IN' : 'US');
  useEffect(() => {
    if (window.location.hash === '#usa' && usa) setTerritory('US');
  }, [usa]);
  const s = (territory === 'US' ? usa : india) ?? india ?? usa!;
  const cur = s.currency;

  const [mode, setMode] = useState<'daily' | 'cumulative'>('daily');
  const [metric, setMetric] = useState<ChartMetric>('gross');
  const [chart, setChart] = useState<'bar' | 'line'>('bar');
  const [preset, setPreset] = useState<Preset>('all');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const hasLater = !!s.later;
  const [win, setWin] = useState<'tracked' | 'later' | 'all'>('all');
  const window_ = hasLater ? win : 'tracked';

  // reset range when the territory changes (different dates)
  useEffect(() => {
    setPreset('all');
    setFrom('');
    setTo('');
  }, [territory]);

  const dates = s.points.map((p) => p.date);
  const range = useMemo((): { from: string | null; to: string | null } => {
    if (!dates.length) return { from: null, to: null };
    const last = dates[dates.length - 1];
    if (preset === 'window') return { from: s.official.start, to: s.official.end };
    if (preset === 'last7') return { from: dates[Math.max(0, dates.length - 7)], to: last };
    if (preset === 'last14') return { from: dates[Math.max(0, dates.length - 14)], to: last };
    if (preset === 'custom') return { from: from || null, to: to || null };
    return { from: null, to: null };
  }, [preset, from, to, dates, s.official.start, s.official.end]);
  const rangeQ: RangeQuery = { ...range, window: window_ };
  const pts = pointsInRange(s.points, range.from, range.to, window_);

  return (
    <div className="space-y-4 sm:space-y-5">
      <Header s={s} india={india} usa={usa} territory={territory} setTerritory={(t) => {
        setTerritory(t);
        history.replaceState(null, '', t === 'US' ? '#usa' : '#box-office');
      }} releaseLabel={releaseLabel} languages={languages} />
      {territory === 'US' && <p className="-mt-1 text-[11px] text-textFaint">USA figures cover Indian-language screenings tracked in the USA — not total US theatrical box office. Amounts in US dollars.</p>}
      <MetricStrip s={s} />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-white/[0.07] bg-[#0c0c0e] p-2.5 sm:gap-3 sm:p-3">
        <Segmented label="Daily or cumulative" value={mode} onChange={setMode} options={[{ value: 'daily', label: 'Daily' }, { value: 'cumulative', label: 'Cumulative' }]} />
        <Segmented
          label="Metric"
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'gross', label: 'Gross' },
            { value: 'tickets', label: 'Tickets' },
            { value: 'shows', label: 'Shows' },
            { value: 'seats', label: 'Seats', disabled: !s.points.some((p) => p.seats != null), reason: 'Seat counts not available' }
          ]}
        />
        <Segmented
          label="Days"
          value={win}
          onChange={setWin}
          options={[
            { value: 'all', label: 'All days' },
            { value: 'tracked', label: 'Tracked', disabled: !hasLater, reason: 'Only tracked days for this movie' },
            { value: 'later', label: 'Later days', disabled: !hasLater, reason: s.territory === 'US' ? 'Not tracked for the USA' : 'No days captured after the tracking window' }
          ]}
        />
        <Select label="Range" value={preset} onChange={(v) => setPreset(v as Preset)}>
          <option value="all">All dates</option>
          <option value="window" disabled={!hasLater}>
            Tracking window
          </option>
          <option value="last7">Last 7 days</option>
          <option value="last14">Last 14 days</option>
          <option value="custom">Custom…</option>
        </Select>
        {preset === 'custom' && (
          <>
            <Select label="From" value={from} onChange={setFrom}>
              <option value="">Start</option>
              {dates.map((d) => (
                <option key={d} value={d} disabled={!!to && d > to}>
                  {shortDate(d)}
                </option>
              ))}
            </Select>
            <Select label="To" value={to} onChange={setTo}>
              <option value="">Latest</option>
              {dates.map((d) => (
                <option key={d} value={d} disabled={!!from && d < from}>
                  {shortDate(d)}
                </option>
              ))}
            </Select>
          </>
        )}
        <div className="ml-auto">
          <Segmented label="Chart type" size="sm" value={chart} onChange={setChart} options={[{ value: 'bar', label: 'Bars' }, { value: 'line', label: 'Line' }]} />
        </div>
      </div>

      <MainChart s={s} pts={pts} mode={mode} metric={metric} chart={chart} />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <AdvancePanel key={`adv-${s.territory}`} s={s} />
        <IntradayPanel key={`live-${s.territory}`} s={s} />
      </div>

      <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
        <DistributionCard key={`st-${s.territory}`} s={s} dimension="state" title="By state" range={rangeQ} />
        <DistributionCard key={`ci-${s.territory}`} s={s} dimension="city" title="By city" range={rangeQ} />
        <DistributionCard key={`la-${s.territory}`} s={s} dimension="language" title="By language" range={rangeQ} />
        <DistributionCard key={`fo-${s.territory}`} s={s} dimension="format" title="By format" range={rangeQ} />
      </div>

      <ExplorerPanel key={`ex-${s.territory}`} s={s} range={rangeQ} />
      <DailyTable s={s} pts={pts} />

      {india && usa && india.points.length > 0 && usa.points.length > 0 && <IndiaUsaPanel india={india} usa={usa} metric={metric} cumulative={mode === 'cumulative'} />}
      <ComparePanel key={`cmp-${s.territory}`} s={s} metric={metric} cumulative={mode === 'cumulative'} />
      <ScenarioPanel s={s} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Header({
  s,
  india,
  usa,
  territory,
  setTerritory,
  releaseLabel,
  languages
}: {
  s: MovieStats;
  india: MovieStats | null;
  usa: MovieStats | null;
  territory: 'IN' | 'US';
  setTerritory: (t: 'IN' | 'US') => void;
  releaseLabel: string | null;
  languages: string[];
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-white/[0.07] bg-[#0c0c0e] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="relative h-[66px] w-[44px] flex-none overflow-hidden rounded-md border border-white/10 bg-surface2">
          {s.poster && <Image src={s.poster} alt="" fill unoptimized sizes="44px" className="object-cover" />}
        </div>
        <div className="min-w-0">
          <div className="mdtype-overline text-textFaint">Movie stats</div>
          <h2 className="truncate text-xl font-bold tracking-tight text-text sm:text-2xl">{s.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-textDim">
            {releaseLabel && <span>{releaseLabel}</span>}
            {languages.length > 0 && <span>{languages.slice(0, 4).join(' · ')}</span>}
            <Tag tone={s.state === 'live' ? 'red' : s.state === 'final' ? 'zinc' : 'amber'}>
              {s.state === 'live' && '● '}
              {STATE_TEXT[s.state] ?? s.state}
            </Tag>
            {s.carriedOver && <Tag tone="zinc">Tracked period · since {s.historyStart ? shortDate(s.historyStart) : '—'}</Tag>}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:items-end">
        <Segmented
          label="Territory"
          value={territory}
          onChange={setTerritory}
          options={[
            { value: 'IN', label: 'India', disabled: !india, reason: 'No India figures for this movie' },
            { value: 'US', label: 'USA', disabled: !usa, reason: 'No USA figures for this movie' }
          ]}
        />
        <div className="font-mono text-[11px] text-textFaint">
          {s.lastUpdated ? `Updated ${s.lastUpdated}` : 'Not updated yet'} · {s.sourceLabel}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function MetricStrip({ s }: { s: MovieStats }) {
  const cur = s.currency;
  const card = (k: MetricCard) => s.cards.find((c) => c.key === k)!;
  const o = s.official;
  const tracked = s.points.filter((p) => p.window === 'tracked');
  const sumNullable = (k: 'ff' | 'hf') => (tracked.length && tracked.every((p) => p[k] != null) ? tracked.reduce((a, p) => a + (p[k] as number), 0) : null);
  const adv = s.advance[0] ?? null;
  const lastVenues = [...tracked].reverse().find((p) => p.venues != null) ?? null;
  const range = o.start && o.end ? `${shortDate(o.start)} – ${shortDate(o.end)}` : null;
  const cell = (k: MetricCard, value: string, sub?: React.ReactNode) => {
    const c = card(k);
    return (
      <div key={k} className="min-w-0 border-white/[0.07] px-4 py-3.5" title={c.available ? undefined : c.reason}>
        <div className="truncate text-[11px] font-medium uppercase tracking-[0.33px] text-textFaint">{c.label}</div>
        <div className={`mt-1 truncate font-mono text-xl font-semibold tabular-nums tracking-[-0.5px] ${c.available ? 'text-text' : 'text-zinc-600'}`}>{c.available ? value : '—'}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-textFaint">{c.available ? sub : c.reason}</div>
      </div>
    );
  };
  const later = s.later;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="col-span-2 rounded-[14px] border border-gold/20 md:col-span-1 bg-gradient-to-br from-gold/[0.07] to-transparent px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.33px] text-textFaint">{card('official').label}</span>
            {s.totalLabel !== 'Lifetime' && tracked.length > 0 && <Tag title="The tracking window's own total. Days captured after the window are shown separately.">{s.totalLabel === 'Total tracked' ? 'Tracked period' : 'Tracked window'}</Tag>}
            {o.check && !o.check.ok && <Tag tone="red" title="The day-by-day sum differs from the published window total">Check</Tag>}
          </div>
          <div className="mt-1.5 font-mono text-[30px] font-semibold leading-none tracking-[-0.75px] text-gold sm:text-[34px]">{tracked.length ? formatMoney(o.gross, cur) : '—'}</div>
          <div className="mt-2 font-mono text-xs text-textFaint">{tracked.length ? `${o.days} day${o.days === 1 ? '' : 's'}${range ? ` · ${range}` : ''}` : card('official').reason}</div>
        </div>
        <div className="min-w-0 rounded-[14px] border border-white/[0.07] bg-[#0c0c0e] px-4 py-4 sm:px-5" title={later ? undefined : card('later').reason}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.33px] text-textFaint">Later-day gross</span>
            {later && <Tag tone="zinc">Not in official total</Tag>}
          </div>
          <div className={`mt-1.5 font-mono text-xl font-semibold leading-none tracking-[-0.75px] sm:text-[26px] ${later ? 'text-zinc-200' : 'text-zinc-600'}`}>{later ? formatMoney(later.gross, cur) : '—'}</div>
          <div className="mt-2 font-mono text-xs text-textFaint">{later ? `${later.days} day${later.days === 1 ? '' : 's'} after the window · ${shortDate(later.first)} – ${shortDate(later.last)}` : card('later').reason}</div>
        </div>
        <div className="min-w-0 rounded-[14px] border border-white/[0.07] bg-[#0c0c0e] px-4 py-4 sm:px-5" title={s.today ? undefined : card('today').reason}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.33px] text-textFaint">Today</span>
            {s.today && <Tag tone="red">● Live</Tag>}
          </div>
          <div className={`mt-1.5 font-mono text-xl font-semibold leading-none tracking-[-0.75px] sm:text-[26px] ${s.today ? 'text-text' : 'text-zinc-600'}`}>{s.today ? formatMoney(s.today.gross, cur) : '—'}</div>
          <div className="mt-2 font-mono text-xs text-textFaint">
            {s.today ? `${s.today.label}${s.today.completedAsOf ? ` · completed as of ${s.today.completedAsOf}` : ''}` : card('today').reason}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-white/[0.07] overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#0c0c0e] sm:grid-cols-3 lg:grid-cols-6 2xl:grid-cols-12 [&>*]:border-b [&>*]:border-r">
        {cell('tickets', formatMetric('tickets', o.tickets, cur), 'tracked window')}
        {cell('shows', formatMetric('shows', o.shows, cur), 'tracked window')}
        {cell('seats', o.seats != null ? formatMetric('seats', o.seats, cur) : '—', o.seats != null ? 'tracked window' : 'some days without seats')}
        {cell('occupancy', formatOccupancy(o.occupancy), 'tickets ÷ seats')}
        {cell('venues', o.venues != null ? formatMetric('venues', o.venues, cur) : lastVenues ? formatMetric('venues', lastVenues.venues, cur) : '—', o.venues != null ? 'distinct, whole window' : lastVenues ? `${lastVenues.label}` : 'not available')}
        {cell('ff', sumNullable('ff') != null ? formatMetric('ff', sumNullable('ff'), cur) : '—', 'fast-filling shows')}
        {cell('hf', sumNullable('hf') != null ? formatMetric('hf', sumNullable('hf'), cur) : '—', 'housefull shows')}
        {cell('advance', adv ? formatMoney(adv.gross, cur) : '—', adv ? `${adv.label} · ${shortDate(adv.date)}` : undefined)}
        {cell('opening', s.opening ? formatMoney(s.opening.gross, cur) : '—', s.opening ? shortDate(s.opening.date) : undefined)}
        {cell('days', String(o.days), s.later ? `+ ${s.later.days} later` : 'with shows')}
        {cell('atp', o.atp != null ? formatMetric('atp', o.atp, cur) : '—', 'gross ÷ tickets')}
        {cell('best', s.best ? formatMoney(s.best.gross, cur) : '—', s.best ? (s.best.day != null ? `${s.best.label} · ${shortDate(s.best.date)}` : formatDate(s.best.date)) : undefined)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A / B. Daily bars or cumulative line, later days distinguished
// ---------------------------------------------------------------------------

function MainChart({ s, pts, mode, metric, chart }: { s: MovieStats; pts: StatsPoint[]; mode: 'daily' | 'cumulative'; metric: ChartMetric; chart: 'bar' | 'line' }) {
  const cur = s.currency;
  const val = (p: StatsPoint) => (metric === 'seats' ? p.seats : p[metric]);
  const labels = pts.map(pointAxisLabel);
  const tips = pts.map(pointTooltip);
  const firstLater = pts.findIndex((p) => p.window === 'later');
  const markers = firstLater > 0 ? [{ index: firstLater, label: 'after tracking window' }] : [];
  let series;
  let legend;
  if (mode === 'daily') {
    const values = pts.map(val);
    series =
      chart === 'bar'
        ? [{ key: 'v', name: METRIC_NAME[metric], type: 'bar' as const, color: AMBER, values, colorAt: (i: number) => (pts[i]?.window === 'later' ? LATER : pts[i]?.final === false ? '#fcd34d' : AMBER) }]
        : [
            { key: 't', name: `${METRIC_NAME[metric]} (tracked)`, type: 'line' as const, color: AMBER, values: pts.map((p) => (p.window === 'tracked' ? val(p) : null)) },
            { key: 'l', name: `${METRIC_NAME[metric]} (later)`, type: 'line' as const, color: LATER, dashed: true, values: pts.map((p, i) => (p.window === 'later' || (i === firstLater - 1 && firstLater > 0) ? val(p) : null)), hidden: firstLater < 0 }
          ];
    const lastT = [...pts].reverse().find((p) => p.window === 'tracked');
    const lastL = [...pts].reverse().find((p) => p.window === 'later');
    legend = (
      <>
        <LegendItem color={AMBER} label="Tracked window" value={lastT ? fmtMetric(metric, val(lastT), cur) : undefined} />
        {lastL && <LegendItem color={LATER} label="Later days (not official)" value={fmtMetric(metric, val(lastL), cur)} dashed={chart === 'line'} />}
        {pts.length > 0 && <span className="text-[11px] text-textFaint">latest day</span>}
      </>
    );
  } else {
    let run = 0;
    let seatsGap = false;
    const cum = pts.map((p) => {
      const v = val(p);
      if (v == null) seatsGap = true;
      run += v ?? 0;
      return seatsGap ? null : run;
    });
    const tracked = cum.map((v, i) => (pts[i].window === 'tracked' ? v : null));
    const later = cum.map((v, i) => (pts[i].window === 'later' || (i === firstLater - 1 && firstLater > 0) ? v : null));
    series = [
      { key: 't', name: 'Tracked window', type: (chart === 'bar' ? 'bar' : 'area') as 'bar' | 'area', color: AMBER, values: tracked },
      { key: 'l', name: 'Incl. later days (not official)', type: (chart === 'bar' ? 'bar' : 'line') as 'bar' | 'line', color: LATER, dashed: true, values: chart === 'bar' ? cum.map((v, i) => (pts[i].window === 'later' ? v : null)) : later, hidden: firstLater < 0 }
    ];
    const lastTracked = [...tracked].reverse().find((v) => v != null) ?? null;
    const lastAll = [...cum].reverse().find((v) => v != null) ?? null;
    legend = (
      <>
        <LegendItem color={AMBER} label="Tracked window" value={fmtMetric(metric, lastTracked, cur)} />
        {firstLater >= 0 && <LegendItem color={LATER} label="Incl. later days (not official)" value={fmtMetric(metric, lastAll, cur)} dashed />}
      </>
    );
  }
  const t = totalsOf(pts.filter((p) => p.window === 'tracked'));
  const tl = totalsOf(pts.filter((p) => p.window === 'later'));
  const pick = (x: typeof t) => (metric === 'seats' ? x.seats : x[metric]);
  return (
    <ChartCard
      title={`${mode === 'daily' ? 'Daily' : 'Cumulative'} ${METRIC_NAME[metric].toLowerCase()}`}
      sub={pts.length ? `${pts.length} day${pts.length === 1 ? '' : 's'} · ${shortDate(pts[0].date)} – ${shortDate(pts[pts.length - 1].date)}${mode === 'cumulative' && firstLater >= 0 ? ' · the running total after the window is shown apart and is not the official total' : ''}` : undefined}
      legend={pts.length ? legend : undefined}
      right={
        pts.length ? (
          <span className="font-mono text-xs text-textFaint">
            {t.days > 0 && `Σ tracked ${fmtMetric(metric, pick(t), cur)}`}
            {tl.days > 0 && `${t.days > 0 ? ' · ' : ''}Σ later ${fmtMetric(metric, pick(tl), cur)}`}
          </span>
        ) : undefined
      }
    >
      {pts.length ? (
        <StatsChart height={300} ariaLabel={`${mode} ${metric} by day`} labels={labels} tooltipLabels={tips} series={series} format={axisFor(metric, cur)} formatValue={(v) => fmtMetric(metric, v, cur)} markers={markers} />
      ) : (
        <Empty h={260}>{s.points.length ? 'No days in this range.' : s.advance.length ? 'Box office starts on release. Advance bookings are below.' : 'No box office tracked yet.'}</Empty>
      )}
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Day-by-day table
// ---------------------------------------------------------------------------

type DayCol = 'date' | 'gross' | 'tickets' | 'shows' | 'seats' | 'occupancy' | 'occupancySource' | 'atp' | 'venues' | 'ff' | 'hf';

function DailyTable({ s, pts }: { s: MovieStats; pts: StatsPoint[] }) {
  const cur = s.currency;
  const [sort, setSort] = useState<DayCol>('date');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  useEffect(() => setOffset(0), [pts.length, s.territory]);
  const hasSrcOcc = pts.some((p) => p.occupancySource != null);
  const hasFf = pts.some((p) => p.ff != null);
  const sorted = useMemo(() => {
    const sign = dir === 'asc' ? 1 : -1;
    return [...pts].sort((a, b) => {
      if (sort === 'date') return sign * a.date.localeCompare(b.date);
      const x = a[sort];
      const y = b[sort];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return sign * (x - y);
    });
  }, [pts, sort, dir]);
  const n = (v: number | null, k: 'shows' | 'tickets' = 'shows') => (v == null ? '—' : formatMetric(k, v, cur));
  const cols: Col<StatsPoint>[] = [
    {
      key: 'date',
      label: 'Day',
      sortable: true,
      render: (p) => (
        <span className="flex items-center gap-2">
          <span className="flex flex-col">
            <span className="text-text">{p.label}</span>
            <span className="text-[11px] text-textFaint">{formatDate(p.date)}</span>
          </span>
          {p.window === 'later' && <Tag tone="zinc">Later</Tag>}
          {!p.final && <Tag tone="red">Live</Tag>}
        </span>
      )
    },
    { key: 'gross', label: 'Gross', align: 'right', sortable: true, className: '!text-gold', render: (p) => formatMoney(p.gross, cur) },
    { key: 'tickets', label: 'Tickets', align: 'right', sortable: true, render: (p) => n(p.tickets, 'tickets') },
    { key: 'shows', label: 'Shows', align: 'right', sortable: true, render: (p) => n(p.shows) },
    { key: 'seats', label: 'Seats', align: 'right', sortable: true, render: (p) => n(p.seats) },
    { key: 'occupancy', label: 'Occ.', align: 'right', sortable: true, render: (p) => formatOccupancy(p.occupancy) },
    ...(hasSrcOcc ? [{ key: 'occupancySource', label: 'Occ. (published)', align: 'right' as const, sortable: true, title: 'Occupancy as published by the source', render: (p: StatsPoint) => formatOccupancy(p.occupancySource) }] : []),
    { key: 'atp', label: 'ATP', align: 'right', sortable: true, render: (p) => (p.atp == null ? '—' : formatMetric('atp', p.atp, cur)) },
    { key: 'venues', label: s.territory === 'US' ? 'Theatres' : 'Venues', align: 'right', sortable: true, render: (p) => n(p.venues) },
    ...(hasFf
      ? [
          { key: 'ff', label: 'FF', align: 'right' as const, sortable: true, title: 'Fast-filling shows', render: (p: StatsPoint) => n(p.ff) },
          { key: 'hf', label: 'HF', align: 'right' as const, sortable: true, title: 'Housefull shows', render: (p: StatsPoint) => n(p.hf) }
        ]
      : []),
    { key: 'updated', label: 'Updated', render: (p) => <span className="text-[11px] text-textFaint">{p.sourceUpdated ?? '—'}</span> }
  ];
  const tracked = totalsOf(pts.filter((p) => p.window === 'tracked'));
  const foot = pts.length ? (
    <tr className="h-11 border-t border-white/10">
      <td className="sticky left-0 bg-[#111114] px-4 text-[11px] font-semibold uppercase tracking-wide text-textDim sm:px-5">Tracked days in range</td>
      <td className="px-3 text-right font-mono text-[13px] text-gold sm:px-5">{formatMoney(tracked.gross, cur)}</td>
      <td className="px-3 text-right font-mono text-[13px] sm:px-5">{n(tracked.tickets, 'tickets')}</td>
      <td className="px-3 text-right font-mono text-[13px] sm:px-5">{n(tracked.shows)}</td>
      <td className="px-3 text-right font-mono text-[13px] sm:px-5">{n(tracked.seats)}</td>
      <td className="px-3 text-right font-mono text-[13px] sm:px-5">{formatOccupancy(tracked.occupancy)}</td>
      <td colSpan={cols.length - 6} />
    </tr>
  ) : null;
  return (
    <ChartCard title="Day by day" sub={`${pts.length} day${pts.length === 1 ? '' : 's'} in range${s.later ? ' · later days are listed but never added to the tracked total' : ''}`}>
      {pts.length ? (
        <>
          <DataTable
            caption="Day-by-day figures"
            cols={cols}
            rows={pageOf(sorted, offset, limit)}
            rowKey={(p) => p.date}
            sort={sort}
            dir={dir}
            onSort={(k) => {
              if (k === 'updated') return;
              if (k === sort) setDir(dir === 'asc' ? 'desc' : 'asc');
              else {
                setSort(k as DayCol);
                setDir('desc');
              }
              setOffset(0);
            }}
            rowClass={(p) => (p.window === 'later' ? 'opacity-80' : '')}
            foot={foot}
          />
          <Pager offset={offset} limit={limit} total={pts.length} onPage={setOffset} onLimit={(x) => {
            setLimit(x);
            setOffset(0);
          }} />
        </>
      ) : (
        <Empty>{s.points.length ? 'No days in this range.' : 'No box office tracked yet.'}</Empty>
      )}
    </ChartCard>
  );
}
