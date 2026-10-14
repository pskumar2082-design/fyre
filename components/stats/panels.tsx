'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/bfilmy/adapter';
import { formatMoney, formatMetric } from '@/lib/analytics/format';
import { scenario, type MovieStats, type StatsColumn, type StatsDimension, type StatsRow } from '@/lib/analytics/statsModel';
import type { StatsBreakdown, StatsSnapshots } from '@/lib/analytics/stats';
import type { Comparison, Currency } from '@/lib/analytics/types';
import { useMovieCatalog } from '@/lib/compare/useMovieCatalog';
import MovieSelector from '@/components/compare/MovieSelector';
import { movieColorHex } from '@/components/compare/movieColors';
import type { TTListedMovie } from '@/lib/boxoffice/types';
import StatsChart from './StatsChart';
import { ChartCard, DataTable, Empty, LegendItem, Pager, Segmented, Select, ShareBars, Skeleton, Tag, useInView, type Col } from './parts';
import { axisCount, axisFor, axisMoney, COLUMN_LABEL, fmtColumn, fmtMetric, METRIC_NAME, shortDate, type ChartMetric } from './fmt';
import { useJson } from './useJson';

const AMBER = '#fbbf24';
const SKY = '#38BDF8';
const ZINC = '#a1a1aa';

export type RangeQuery = { from: string | null; to: string | null; window: 'tracked' | 'later' | 'all' };

const enc = encodeURIComponent;
const tq = (s: MovieStats) => (s.territory === 'US' ? '&territory=us' : '');
const rq = (r: RangeQuery) => `${r.from ? `&from=${r.from}` : ''}${r.to ? `&to=${r.to}` : ''}&window=${r.window}`;

// ---------------------------------------------------------------------------
// C. Advance build-up
// ---------------------------------------------------------------------------

export function AdvancePanel({ s }: { s: MovieStats }) {
  const dates = s.advance.length ? s.advance : s.advanceAll.slice(-5).reverse();
  const [date, setDate] = useState<string>(dates[0]?.date ?? '');
  const { ref, seen } = useInView<HTMLDivElement>();
  const url = seen && date && s.advanceHistory ? `/api/analytics/stats/snapshots?slug=${enc(s.slug)}&kind=advance&date=${date}${tq(s)}` : null;
  const { data, loading, error } = useJson<StatsSnapshots>(url);
  const cur = s.currency;
  const pts = data?.available ? data.points : [];
  const last = pts[pts.length - 1];
  const stored = dates.find((d) => d.date === date);
  return (
    <div ref={ref} className="min-w-0">
      <ChartCard
        small
        title="Advance build-up"
        sub={s.advanceHistory === 'daily' ? 'One capture a day per show date' : 'Every refresh of this show date, as captured'}
        right={
          dates.length > 0 ? (
            <Select label="Show date" value={date} onChange={setDate}>
              {dates.map((d) => (
                <option key={d.date} value={d.date}>
                  {shortDate(d.date)}
                  {d.date < (s.advance[0]?.date ?? '') ? ' (closed)' : ''}
                </option>
              ))}
            </Select>
          ) : undefined
        }
        legend={
          last ? (
            <>
              <LegendItem color={AMBER} label="Gross" value={formatMoney(last.gross, cur)} />
              <LegendItem color={SKY} label="Tickets" value={formatMetric('tickets', last.tickets, cur)} dashed />
              <span className="text-[11px] text-textFaint">latest</span>
            </>
          ) : stored ? (
            <LegendItem color={AMBER} label="Latest stored" value={formatMoney(stored.gross, cur)} />
          ) : undefined
        }
      >
        {!dates.length ? (
          <Empty h={200}>No advance bookings are open for this movie.</Empty>
        ) : !s.advanceHistory ? (
          <Empty h={200}>Advance build-up history is not available for this movie. The latest advance figure is shown above.</Empty>
        ) : loading || !seen ? (
          <Skeleton h={200} />
        ) : error ? (
          <Empty h={200}>{error}</Empty>
        ) : !data?.available ? (
          <Empty h={200}>{data?.reason ?? 'No captures yet'}</Empty>
        ) : (
          <StatsChart
            height={200}
            ariaLabel={`Advance build-up for ${formatDate(date)}`}
            labels={pts.map((p) => (data.cadence === 'daily' ? shortDate(p.label) : p.label.replace(/^\d+ \w+ /, '')))}
            tooltipLabels={pts.map((p) => (data.cadence === 'daily' ? `Captured ${formatDate(p.label)}` : `Refresh ${p.label}`))}
            series={[
              { key: 'g', name: 'Gross', type: 'area', color: AMBER, values: pts.map((p) => p.gross) },
              { key: 't', name: 'Tickets', type: 'line', color: SKY, dashed: true, axis: 'right', values: pts.map((p) => p.tickets) }
            ]}
            format={(v) => axisMoney(v, cur)}
            formatRight={(v) => axisCount(v, cur)}
            formatValue={(v, axis) => (axis === 'right' ? formatMetric('tickets', v, cur) : formatMoney(v, cur))}
          />
        )}
      </ChartCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// D. Live intraday
// ---------------------------------------------------------------------------

export function IntradayPanel({ s }: { s: MovieStats }) {
  const day = s.today ?? null;
  const { ref, seen } = useInView<HTMLDivElement>();
  const url = seen && day && s.intraday ? `/api/analytics/stats/snapshots?slug=${enc(s.slug)}&kind=boxoffice&date=${day.date}${tq(s)}` : null;
  const { data, loading, error } = useJson<StatsSnapshots>(url);
  const cur = s.currency;
  const pts = data?.available ? data.points : [];
  const last = pts[pts.length - 1];
  return (
    <div ref={ref} className="min-w-0">
      <ChartCard
        small
        title="Live today"
        sub={day ? `${day.label} · ${formatDate(day.date)}${day.completedAsOf ? ` · shows completed as of ${day.completedAsOf}` : ''}` : 'Today’s running total, refresh by refresh'}
        right={day ? <Tag tone="red">● Live</Tag> : undefined}
        legend={
          last ? (
            <>
              <LegendItem color={AMBER} label="Gross" value={formatMoney(last.gross, cur)} />
              <span className="text-[11px] text-textFaint">latest</span>
            </>
          ) : day ? (
            <LegendItem color={AMBER} label="Gross" value={formatMoney(day.gross, cur)} />
          ) : undefined
        }
      >
        {!day ? (
          <Empty h={200}>No live day is running for this movie right now.</Empty>
        ) : !s.intraday ? (
          <Empty h={200}>Refresh-by-refresh history is not available for this movie. Today’s latest figure is shown above.</Empty>
        ) : loading || !seen ? (
          <Skeleton h={200} />
        ) : error ? (
          <Empty h={200}>{error}</Empty>
        ) : !data?.available ? (
          <Empty h={200}>{data?.reason ?? 'No refreshes captured yet'}</Empty>
        ) : (
          <StatsChart
            height={200}
            ariaLabel="Today's running gross by refresh"
            labels={pts.map((p) => p.label.replace(/^\d+ \w+ /, ''))}
            tooltipLabels={pts.map((p) => `Refresh ${p.label}${p.completedAsOf ? ` · completed as of ${p.completedAsOf}` : ''}`)}
            series={[
              { key: 'g', name: 'Gross', type: 'area', color: AMBER, values: pts.map((p) => p.gross) },
              { key: 't', name: 'Tickets', type: 'line', color: SKY, dashed: true, axis: 'right', values: pts.map((p) => p.tickets) }
            ]}
            format={(v) => axisMoney(v, cur)}
            formatRight={(v) => axisCount(v, cur)}
            formatValue={(v, axis) => (axis === 'right' ? formatMetric('tickets', v, cur) : formatMoney(v, cur))}
          />
        )}
      </ChartCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// E-H. Distributions
// ---------------------------------------------------------------------------

export function DistributionCard({ s, dimension, title, range }: { s: MovieStats; dimension: StatsDimension; title: string; range: RangeQuery }) {
  const { ref, seen } = useInView<HTMLDivElement>();
  const avail = s.dimensions.find((d) => d.key === dimension);
  const url = seen && avail?.available && s.points.length ? `/api/analytics/stats/breakdown?slug=${enc(s.slug)}&dimension=${dimension}${tq(s)}${rq(range)}&limit=8&sort=gross&dir=desc` : null;
  const { data, loading, error } = useJson<StatsBreakdown>(url);
  const cur = s.currency;
  const top: { key: string; name: string; sub: string | null; value: number; share: number | null; muted?: boolean }[] = (data?.rows ?? []).map((r) => ({ key: r.key, name: r.name, sub: dimension === 'city' ? r.sub : null, value: r.values.gross ?? 0, share: r.values.share ?? null }));
  const other = data?.totals?.gross != null && data.total > top.length ? Math.max(0, data.totals.gross - top.reduce((a, r) => a + r.value, 0)) : 0;
  if (other > 0) top.push({ key: 'other', name: `Other (${data!.total - top.length})`, sub: null, muted: true, value: other, share: data!.totals!.gross ? (other / data!.totals!.gross) * 100 : null });
  return (
    <div ref={ref} className="min-w-0">
      <ChartCard
        small
        title={title}
        sub={data?.available ? `${data.coverage.withBreakdown} day${data.coverage.withBreakdown === 1 ? '' : 's'}${data.coverage.missing.length ? ` · ${data.coverage.missing.length} without a breakdown` : ''}${data.live ? ' · includes a live day' : ''}` : 'Share of gross'}
      >
        {!avail?.available ? (
          <Empty h={150}>{avail?.reason ?? 'Not available'}</Empty>
        ) : !s.points.length ? (
          <Empty h={150}>No box office tracked yet.</Empty>
        ) : loading || !seen ? (
          <Skeleton h={180} />
        ) : error ? (
          <Empty h={150}>{error}</Empty>
        ) : !data?.available ? (
          <Empty h={150}>{data?.reason ?? 'Not available'}</Empty>
        ) : (
          <ShareBars rows={top} format={(v) => formatMoney(v, cur)} emptyText="No rows" />
        )}
      </ChartCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breakdown explorer (dense table)
// ---------------------------------------------------------------------------

export function ExplorerPanel({ s, range }: { s: MovieStats; range: RangeQuery }) {
  const dims = s.dimensions;
  const [dimension, setDimension] = useState<StatsDimension>('state');
  const [kind, setKind] = useState<'boxoffice' | 'advance'>('boxoffice');
  const [adate, setAdate] = useState<string>(s.advance[0]?.date ?? s.advanceAll[s.advanceAll.length - 1]?.date ?? '');
  const [state, setState] = useState('');
  const [format, setFormat] = useState('');
  const [sort, setSort] = useState<StatsColumn | 'name'>('gross');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const { ref, seen } = useInView<HTMLDivElement>();
  const cur = s.currency;
  const avail = dims.find((d) => d.key === dimension);
  const filters = `${state && (dimension === 'city' || dimension === 'city_format') ? `&state=${enc(state)}` : ''}${format && dimension === 'city_format' ? `&format=${enc(format)}` : ''}`;
  const kindQ = kind === 'advance' ? `&kind=advance${adate ? `&date=${adate}` : ''}` : rq(range);
  const url =
    seen && avail?.available && (kind === 'advance' ? s.advanceAll.length : s.points.length)
      ? `/api/analytics/stats/breakdown?slug=${enc(s.slug)}&dimension=${dimension}${tq(s)}${kindQ}${filters}&sort=${sort}&dir=${dir}&offset=${offset}&limit=${limit}`
      : null;
  const { data, loading, error } = useJson<StatsBreakdown>(url);
  // keep the filter lists from the unfiltered answer
  const [lists, setLists] = useState<{ states: string[]; formats: string[] }>({ states: [], formats: [] });
  useEffect(() => {
    if (data?.available && !filters) setLists({ states: data.states, formats: data.formats });
  }, [data, filters]);

  const reset = () => setOffset(0);
  const onSort = (k: string) => {
    if (k === sort) setDir(dir === 'desc' ? 'asc' : 'desc');
    else {
      setSort(k as StatsColumn | 'name');
      setDir(k === 'name' ? 'asc' : 'desc');
    }
    reset();
  };
  const columns: StatsColumn[] = data?.columns ?? [];
  const cols: Col<StatsRow>[] = [
    {
      key: 'name',
      label: dims.find((d) => d.key === dimension)?.label ?? 'Name',
      sortable: dimension !== 'territory',
      render: (r) => (
        <span className={`flex flex-col ${r.nested ? 'pl-4' : ''}`}>
          <span className={`max-w-[180px] truncate sm:max-w-[260px] ${r.nested ? 'text-textDim' : 'text-text'}`}>{r.name}</span>
          {r.sub && <span className="max-w-[180px] truncate text-[11px] text-textFaint sm:max-w-[260px]">{r.sub}</span>}
        </span>
      )
    },
    ...columns.map(
      (c): Col<StatsRow> => ({
        key: c,
        label: c === 'venues' && s.territory === 'US' ? 'Theatres' : COLUMN_LABEL[c],
        align: 'right',
        sortable: dimension !== 'territory',
        title: c === 'occupancySource' ? 'Occupancy as published by the source (no seat counts for this split)' : undefined,
        className: c === 'gross' ? '!text-gold' : '',
        render: (r) => fmtColumn(c, r.values[c], cur)
      })
    )
  ];
  const foot =
    data?.available && data.totals ? (
      <tr className="h-11 border-t border-white/10">
        <td className="sticky left-0 bg-[#111114] px-4 text-[11px] font-semibold uppercase tracking-wide text-textDim sm:px-5">
          Total{data.totalStatus && data.totalStatus !== 'MATCH' ? <span className="ml-2 font-mono normal-case text-textFaint">({data.totalStatus.toLowerCase()})</span> : null}
        </td>
        {columns.map((c) => (
          <td key={c} className="whitespace-nowrap px-3 text-right font-mono text-[13px] tabular-nums text-text sm:px-5">
            {fmtColumn(c, data.totals![c], cur)}
          </td>
        ))}
      </tr>
    ) : null;

  return (
    <div ref={ref}>
      <ChartCard
        title="Breakdown explorer"
        sub={
          kind === 'advance'
            ? `Advance bookings · show date ${adate ? formatDate(adate) : '—'}`
            : `${range.window === 'later' ? 'Later days only' : range.window === 'all' ? 'Tracked and later days' : 'Official tracked window'}${range.from || range.to ? ` · ${range.from ? shortDate(range.from) : 'start'} – ${range.to ? shortDate(range.to) : 'latest'}` : ''}`
        }
        right={
          <>
            <Segmented
              size="sm"
              label="Box office or advance"
              value={kind}
              onChange={(v) => {
                setKind(v);
                reset();
              }}
              options={[
                { value: 'boxoffice', label: 'Box office' },
                { value: 'advance', label: 'Advance', disabled: !s.advanceAll.length, reason: 'No advance bookings stored' }
              ]}
            />
            {kind === 'advance' && s.advanceAll.length > 0 && (
              <Select
                label="Show date"
                value={adate}
                onChange={(v) => {
                  setAdate(v);
                  reset();
                }}
              >
                {[...s.advanceAll].reverse().map((a) => (
                  <option key={a.date} value={a.date}>
                    {shortDate(a.date)}
                  </option>
                ))}
              </Select>
            )}
          </>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            label="Breakdown"
            value={dimension}
            onChange={(v) => {
              setDimension(v);
              setState('');
              setFormat('');
              setSort('gross');
              setDir('desc');
              reset();
            }}
            options={dims.map((d) => ({ value: d.key, label: d.label, disabled: !d.available, reason: d.reason }))}
          />
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Select
            label="State"
            value={state}
            disabled={!(dimension === 'city' || dimension === 'city_format') || !lists.states.length}
            title={dimension === 'city' || dimension === 'city_format' ? undefined : 'State filter applies to City and City × Format'}
            onChange={(v) => {
              setState(v);
              reset();
            }}
          >
            <option value="">All states</option>
            {lists.states.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
          <Select
            label="Format"
            value={format}
            disabled={dimension !== 'city_format' || !lists.formats.length}
            title={dimension === 'city_format' ? undefined : 'Format filter applies to City × Format'}
            onChange={(v) => {
              setFormat(v);
              reset();
            }}
          >
            <option value="">All formats</option>
            {lists.formats.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
          <Select label="Language" value="" disabled onChange={() => undefined} title="Language × State / City is not available: the source does not split languages by place">
            <option value="">All languages</option>
          </Select>
          {data?.available && data.coverage.missing.length > 0 && <Tag tone="zinc" title={data.coverage.missing.map(formatDate).join(', ')}>{data.coverage.missing.length} day(s) without breakdown</Tag>}
          {data?.live && <Tag tone="red">Includes live day</Tag>}
        </div>
        {!avail?.available ? (
          <Empty>{avail?.reason ?? 'Not available'}</Empty>
        ) : !(kind === 'advance' ? s.advanceAll.length : s.points.length) ? (
          <Empty>{kind === 'advance' ? 'No advance bookings stored for this movie.' : 'No box office tracked yet.'}</Empty>
        ) : !seen || (loading && !data) ? (
          <Skeleton h={320} />
        ) : error ? (
          <Empty>{error}</Empty>
        ) : !data?.available ? (
          <Empty>{data?.reason ?? 'Not available'}</Empty>
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : ''}>
            <DataTable caption={`${avail.label} breakdown`} cols={cols} rows={data.rows} rowKey={(r) => r.key} sort={sort} dir={dir} onSort={onSort} foot={foot} />
            <Pager
              offset={offset}
              limit={limit}
              total={data.total}
              onPage={setOffset}
              onLimit={(n) => {
                setLimit(n);
                reset();
              }}
            />
            {data.totalNote && <p className="mt-2 text-[11px] text-textFaint">{data.totalNote}</p>}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// I. India vs USA -- two currencies, two separate scales
// ---------------------------------------------------------------------------

export function IndiaUsaPanel({ india, usa, metric, cumulative }: { india: MovieStats; usa: MovieStats; metric: ChartMetric; cumulative: boolean }) {
  const dates = [...new Set([...india.points, ...usa.points].map((p) => p.date))].sort();
  const series = (st: MovieStats) => {
    const by = new Map(st.points.filter((p) => p.window === 'tracked').map((p) => [p.date, p]));
    let run = 0;
    let started = false;
    return dates.map((d) => {
      const p = by.get(d);
      const v = p ? (metric === 'seats' ? p.seats : p[metric]) : null;
      if (!cumulative) return v;
      if (v != null) {
        run += v;
        started = true;
      }
      return started ? run : null;
    });
  };
  const inV = series(india);
  const usV = series(usa);
  const lastOf = (a: (number | null)[]) => [...a].reverse().find((v) => v != null) ?? null;
  return (
    <ChartCard
      title="India vs USA"
      sub={`${METRIC_NAME[metric]}${cumulative ? ' · running total' : ' · daily'} · INR on the left scale, USD on the right — never added together`}
      legend={
        <>
          <LegendItem color={AMBER} label="India (INR)" value={fmtMetric(metric, lastOf(inV), 'INR')} />
          <LegendItem color={SKY} label="USA (USD)" value={fmtMetric(metric, lastOf(usV), 'USD')} />
        </>
      }
    >
      {dates.length ? (
        <StatsChart
          height={260}
          ariaLabel="India and USA by date"
          labels={dates.map(shortDate)}
          tooltipLabels={dates.map((d) => formatDate(d))}
          series={[
            { key: 'in', name: 'India', type: 'line', color: AMBER, values: inV },
            { key: 'us', name: 'USA', type: 'line', color: SKY, values: usV, axis: 'right' }
          ]}
          format={axisFor(metric, 'INR')}
          formatRight={axisFor(metric, 'USD')}
          formatValue={(v, axis) => fmtMetric(metric, v, axis === 'right' ? 'USD' : 'INR')}
        />
      ) : (
        <Empty>No dates tracked yet.</Empty>
      )}
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// J. Comparison with another movie (release day by release day)
// ---------------------------------------------------------------------------

export function ComparePanel({ s, metric, cumulative }: { s: MovieStats; metric: ChartMetric; cumulative: boolean }) {
  const { ref, seen } = useInView<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<TTListedMovie | null>(null);
  const cur: Currency = s.currency;
  const url = pick ? `/api/analytics/compare?movies=${enc(s.slug)},${enc(pick.slug)}&basis=${cumulative ? 'lifetime' : 'day'}&day=1&metric=${metric}${tq(s)}` : null;
  const { data, loading, error } = useJson<Comparison>(url);
  const trend = data?.trend;
  const titles = data?.movies.map((m) => m.title) ?? [s.title, pick?.title ?? ''];
  return (
    <div ref={ref}>
      <ChartCard
        title="Compare with another movie"
        sub={`${METRIC_NAME[metric]} by release day${cumulative ? ' · running total' : ''} · ${s.territory === 'US' ? 'USA' : 'India'}`}
        legend={
          trend
            ? titles.map((t, i) => <LegendItem key={t + i} color={movieColorHex(i)} label={t} value={fmtMetric(metric, [...trend.points].reverse().find((p) => p.values[i] != null)?.values[i] ?? null, cur)} />)
            : undefined
        }
      >
        <div className="mb-4 max-w-md">{seen && open ? <CompareSelector exclude={s.slug} pick={pick} onPick={setPick} /> : <button type="button" onClick={() => setOpen(true)} className="h-10 rounded-lg border border-white/10 bg-black px-4 text-sm font-semibold text-textDim hover:text-text">Choose a movie to compare…</button>}</div>
        {!pick ? (
          <Empty h={180}>Pick a movie to line both up release day by release day.</Empty>
        ) : loading ? (
          <Skeleton h={260} />
        ) : error ? (
          <Empty>{error}</Empty>
        ) : !trend || !trend.points.length ? (
          <Empty>No release days to compare (a movie released before tracking began has no Day numbers).</Empty>
        ) : (
          <StatsChart
            height={260}
            ariaLabel="Comparison by release day"
            labels={trend.points.map((p) => `D${p.day}`)}
            tooltipLabels={trend.points.map((p) => `Day ${p.day}`)}
            series={titles.map((t, i) => ({ key: `m${i}`, name: t, type: 'line' as const, color: movieColorHex(i), values: trend.points.map((p) => p.values[i]) }))}
            format={axisFor(metric, cur)}
            formatValue={(v) => fmtMetric(metric, v, cur)}
          />
        )}
      </ChartCard>
    </div>
  );
}

function CompareSelector({ exclude, pick, onPick }: { exclude: string; pick: TTListedMovie | null; onPick: (m: TTListedMovie | null) => void }) {
  const { movies, loading, error } = useMovieCatalog();
  return <MovieSelector movies={movies} loading={loading} error={error} selected={pick} onSelect={onPick} onClear={pick ? () => onPick(null) : undefined} excludeSlugs={[exclude]} label="Compare with" />;
}

// ---------------------------------------------------------------------------
// Scenario calculator -- estimates only
// ---------------------------------------------------------------------------

export function ScenarioPanel({ s }: { s: MovieStats }) {
  const lastFinal = [...s.points].reverse().find((p) => p.final && p.window === 'tracked');
  const [days, setDays] = useState(7);
  const [drop, setDrop] = useState(12);
  const [lift, setLift] = useState(35);
  const cur = s.currency;
  const startWd = lastFinal ? new Date(`${lastFinal.date}T00:00:00Z`).getUTCDay() : 0;
  const proj = useMemo(() => (lastFinal ? scenario(lastFinal.gross, days, drop, lift, startWd) : []), [lastFinal, days, drop, lift, startWd]);
  const added = proj.reduce((a, p) => a + p.gross, 0);
  const slider = (label: string, value: number, set: (n: number) => void, min: number, max: number, unit: string) => (
    <label className="block">
      <div className="flex items-baseline justify-between text-xs text-textDim">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-text">
          {value}
          {unit}
        </span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} className="mt-2 w-full accent-[#fbbf24]" />
    </label>
  );
  return (
    <ChartCard title="Scenario calculator" sub="What-if projection from the latest finished day. An estimate — not tracked data." right={<Tag>Hypothetical</Tag>}>
      {!lastFinal ? (
        <Empty>Needs at least one finished tracked day.</Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div className="space-y-5">
            {slider('Days ahead', days, setDays, 1, 30, ' d')}
            {slider('Daily drop', drop, setDrop, 0, 50, '%')}
            {slider('Weekend lift', lift, setLift, 0, 150, '%')}
            <p className="text-[11px] text-textFaint">
              Starts from {lastFinal.label} ({formatMoney(lastFinal.gross, cur)}). Saturdays and Sundays get the lift.
            </p>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.33px] text-textFaint">Estimated next {days} days</div>
            <div className="mt-1 font-mono text-[34px] font-semibold leading-none tracking-[-0.75px] text-gold sm:text-[46px]">{formatMoney(added, cur)}</div>
            <div className="mt-2 font-mono text-xs text-textFaint">
              {s.totalLabel} {formatMoney(s.official.gross, cur)} + estimate = {formatMoney(s.official.gross + added, cur)} (hypothetical)
            </div>
            <div className="mt-4">
              <StatsChart
                height={150}
                ariaLabel="Estimated daily gross"
                labels={proj.map((p) => `+${p.day}`)}
                tooltipLabels={proj.map((p) => `Estimate · day +${p.day}`)}
                series={[{ key: 'e', name: 'Estimate', type: 'bar', color: 'rgba(251,191,36,0.45)', values: proj.map((p) => p.gross) }]}
                format={(v) => axisMoney(v, cur)}
                formatValue={(v) => formatMoney(v, cur)}
              />
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

export { ZINC, AMBER, SKY };
