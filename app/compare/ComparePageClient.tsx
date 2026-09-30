'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Plus, Sparkles, X, Image as ImageIcon } from 'lucide-react';
import type { TTListedMovie } from '@/lib/boxoffice/types';
import { useMovieCatalog } from '@/lib/compare/useMovieCatalog';
import { compareQuery, type CompareRequest } from '@/lib/analytics/query';
import { formatMetric } from '@/lib/analytics/format';
import { METRIC_LABELS } from '@/lib/analytics/metrics';
import type { Comparison, Dimension, MetricKey, Metrics, Selection } from '@/lib/analytics/types';
import { Card, SectionHeading, EmptyState } from '@/components/ui';
import MovieSelector from '@/components/compare/MovieSelector';
import { movieDotClass, movieTextClass } from '@/components/compare/movieColors';
import TrendChart from '@/components/analytics/TrendChart';

// Movie Comparison. Every number on this page comes from
// /api/analytics/compare (lib/analytics/compare.ts) -- the same view model
// the comparison poster renders.

const DIMENSIONS: { key: Dimension | 'overview'; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'state', label: 'State' },
  { key: 'city', label: 'City' },
  { key: 'language', label: 'Language' },
  { key: 'language_state', label: 'Language × State' },
  { key: 'format', label: 'Format' },
  { key: 'chain', label: 'Chain' },
  { key: 'venue', label: 'Venue' },
  { key: 'pic', label: 'PIC' },
  { key: 'time_slot', label: 'Time slot' },
  { key: 'price_band', label: 'Ticket price' }
];

const METRICS: MetricKey[] = ['gross', 'tickets', 'shows', 'occupancy', 'atp'];

const SUMMARY_ROWS: MetricKey[] = ['gross', 'tickets', 'shows', 'occupancy', 'atp', 'venues', 'cities', 'states', 'picGross', 'picTickets', 'ff', 'hf'];

function listedStub(m: { slug: string; title: string; poster: string | null }): TTListedMovie {
  return { slug: m.slug, title: m.title, url: `/movie/${m.slug}`, state: 'unknown', dayLabel: null, releaseText: null, genre: null, poster: m.poster, grossLabel: null, gross: null, grossCr: null, todayText: null, updatedText: null };
}

export default function ComparePageClient({ initialRequest, initial }: { initialRequest: CompareRequest; initial: Comparison | null }) {
  const router = useRouter();
  const catalog = useMovieCatalog();
  const [slots, setSlots] = useState<(TTListedMovie | null)[]>(() => {
    const byslug = new Map((initial?.movies ?? []).map((m) => [m.slug, m]));
    const s = initialRequest.slugs.map((slug) => (byslug.get(slug) ? listedStub(byslug.get(slug)!) : null));
    while (s.length < 2) s.push(null);
    return s;
  });
  const [basis, setBasis] = useState<Selection['basis']>(initialRequest.selection.basis);
  const [day, setDay] = useState<number>(initialRequest.selection.basis === 'lifetime' ? 1 : initialRequest.selection.day);
  const [dimension, setDimension] = useState<Dimension | 'overview'>(initialRequest.dimension ?? 'overview');
  const [metric, setMetric] = useState<MetricKey>(initialRequest.metric ?? 'gross');
  const [limit, setLimit] = useState<number | 'all'>(initialRequest.limit ?? 10);
  const [data, setData] = useState<Comparison | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef(true);

  const slugs = slots.filter((s): s is TTListedMovie => !!s).map((s) => s.slug);
  const selection: Selection = basis === 'lifetime' ? { basis } : { basis, day };
  const req: CompareRequest = { slugs, selection, dimension: dimension === 'overview' ? null : dimension, metric, limit };
  const query = slugs.length >= 2 ? compareQuery(req) : '';

  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (initial) return;
    }
    if (slugs.length < 2) {
      setData(null);
      router.replace('/compare', { scroll: false });
      return;
    }
    router.replace(`/compare?${query}`, { scroll: false });
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/analytics/compare?${query}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setData(j as Comparison);
      })
      .catch((e) => e.name !== 'AbortError' && setError(e.message || 'Could not load the comparison'))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayOptions = basis === 'advance' ? data?.advanceDayOptions ?? [] : data?.dayOptions ?? [];
  const select = 'text-sm bg-surface border border-border rounded-full h-10 px-4 text-text hover:border-gold/30 transition';
  const titles = data?.movies.map((m) => m.title) ?? [];

  return (
    <div>
      <SectionHeading title="Movie Comparison" />
      <p className="text-textDim text-sm -mt-2 mb-6">Release-relative: Day 1 is each film’s own first release day, whatever its calendar date.</p>

      <Card className="p-4 sm:p-5 mb-6">
        <div className="grid sm:grid-cols-2 gap-3">
          {slots.map((slot, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`mt-3 w-2.5 h-2.5 rounded-full flex-none ${movieDotClass(i)}`} />
              <MovieSelector
                movies={catalog.movies}
                loading={catalog.loading}
                error={catalog.error}
                selected={slot ? catalog.movies.find((m) => m.slug === slot.slug) ?? slot : null}
                onSelect={(m) => setSlots((prev) => prev.map((p, j) => (j === i ? m : p)))}
                onClear={slot ? () => setSlots((prev) => prev.map((p, j) => (j === i ? null : p))) : undefined}
                excludeSlugs={slugs.filter((s) => s !== slot?.slug)}
                label={`Movie ${String.fromCharCode(65 + i)}`}
              />
              {i >= 2 && (
                <button type="button" aria-label="Remove movie" className="mt-2 text-textFaint hover:text-text" onClick={() => setSlots((prev) => prev.filter((_, j) => j !== i))}>
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {slots.length < 4 && (
            <button type="button" className="text-xs font-semibold text-gold hover:text-goldBright inline-flex items-center gap-1" onClick={() => setSlots((prev) => [...prev, null])}>
              <Plus size={14} /> Add movie
            </button>
          )}
          {slots.length >= 2 && (
            <button type="button" className="text-xs font-semibold text-textDim hover:text-text inline-flex items-center gap-1" onClick={() => setSlots((prev) => [prev[1], prev[0], ...prev.slice(2)])}>
              <ArrowLeftRight size={14} /> Swap A/B
            </button>
          )}
        </div>
      </Card>

      {slugs.length < 2 ? (
        <EmptyState>Pick two movies to compare.</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[1, 7, 10, 30].map((n) => {
              const on = (n === 1 ? basis === 'day' : basis === 'cumulative') && day === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setBasis(n === 1 ? 'day' : 'cumulative');
                    setDay(n);
                  }}
                  className={`text-xs font-semibold px-3.5 py-2 rounded-full border transition ${on ? 'bg-gold/[0.12] border-gold/40 text-gold' : 'border-border text-textDim hover:text-text'}`}
                >
                  {n === 1 ? 'Day 1 vs Day 1' : `First ${n} days`}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setBasis('lifetime')}
              className={`text-xs font-semibold px-3.5 py-2 rounded-full border transition ${basis === 'lifetime' ? 'bg-gold/[0.12] border-gold/40 text-gold' : 'border-border text-textDim hover:text-text'}`}
            >
              Lifetime
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 mb-4">
            <select className={select} value={basis} onChange={(e) => setBasis(e.target.value as Selection['basis'])} aria-label="Compare by">
              <option value="day">Tracked day</option>
              <option value="cumulative">Cumulative through day</option>
              <option value="lifetime">Lifetime</option>
              <option value="advance">Advance booking</option>
            </select>
            {basis !== 'lifetime' && (
              <select className={select} value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Day">
                {(dayOptions.length ? dayOptions : [day]).filter((d) => basis !== 'cumulative' || d >= 1).map((d) => (
                  <option key={d} value={d}>
                    {d === 0 ? 'Day 0 (Pre-release)' : `Day ${d}`}
                  </option>
                ))}
              </select>
            )}
            <select className={select} value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)} aria-label="Metric">
              {METRICS.map((m) => (
                <option key={m} value={m}>
                  {METRIC_LABELS[m]}
                </option>
              ))}
            </select>
            {data && (
              <a className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:text-goldBright" href={`/api/social-poster/x-compare?${query}`} target="_blank" rel="noreferrer">
                <ImageIcon size={14} /> X poster
              </a>
            )}
          </div>

          {error && <div className="text-red text-sm mb-4">{error}</div>}
          {!data ? (
            <EmptyState>{loading ? 'Loading…' : 'No comparison yet.'}</EmptyState>
          ) : (
            <div className={loading ? 'opacity-60 transition' : 'transition'}>
              <div className="mdtype-overline text-textFaint mb-2">{data.context}</div>

              <Card className="p-0 mb-6 overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[480px]">
                  <thead>
                    <tr className="border-b-2 border-gold">
                      <th className="text-left mdtype-overline py-3 px-4 text-textFaint">{data.selectionLabel}</th>
                      {data.movies.map((m, i) => (
                        <th key={m.slug} className={`text-right py-3 px-4 font-bold ${movieTextClass(i)}`}>
                          <a href={`/movie/${m.slug}`} className="hover:underline">
                            {m.title}
                          </a>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.movies.some((m) => !m.available) && (
                      <tr className="border-b border-border">
                        <td className="py-2 px-4 text-textFaint text-xs">Availability</td>
                        {data.movies.map((m) => (
                          <td key={m.slug} className="py-2 px-4 text-right text-xs text-textFaint">
                            {m.available ? 'Tracked' : m.reason}
                          </td>
                        ))}
                      </tr>
                    )}
                    {SUMMARY_ROWS.filter((k) => data.movies.some((m) => m.summary && m.summary[k] != null)).map((k) => (
                      <tr key={k} className="border-b border-border last:border-b-0">
                        <td className="py-2.5 px-4 text-textDim">{METRIC_LABELS[k]}</td>
                        {data.movies.map((m) => (
                          <td key={m.slug} className={`py-2.5 px-4 text-right tabular-nums ${k === metric ? 'font-bold text-text' : 'text-textDim'}`}>
                            {formatMetric(k, m.summary ? (m.summary[k] as number | null) : null)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {data.trend && data.trend.points.length > 1 && (
                <Card className="p-4 sm:p-5 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} className="text-gold" />
                    <h2 className="hdisplay text-base">
                      {METRIC_LABELS[data.trend.metric]} by day{data.trend.cumulative ? ' (running total)' : ''}
                    </h2>
                  </div>
                  <TrendChart trend={data.trend} titles={titles} />
                  <div className="flex flex-wrap gap-4 mt-2 text-xs">
                    {titles.map((t, i) => (
                      <span key={t} className="inline-flex items-center gap-1.5 text-textDim">
                        <span className={`w-2.5 h-2.5 rounded-full ${movieDotClass(i)}`} />
                        {t}
                      </span>
                    ))}
                  </div>
                </Card>
              )}

              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
                {DIMENSIONS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDimension(d.key)}
                    className={`whitespace-nowrap text-xs font-semibold px-3.5 py-2 rounded-full border transition ${
                      dimension === d.key ? 'bg-gold/[0.12] border-gold/40 text-gold' : 'border-border text-textDim hover:text-text hover:border-gold/30'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {dimension !== 'overview' && (
                <BreakdownCompare data={data} metric={metric} limit={limit} setLimit={setLimit} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BreakdownCompare({ data, metric, limit, setLimit }: { data: Comparison; metric: MetricKey; limit: number | 'all'; setLimit: (l: number | 'all') => void }) {
  if (!data.dimension) return null;
  const unavailable = data.movies.filter((_, i) => !data.breakdownAvailable[i]);
  const val = (m: Metrics | null) => formatMetric(metric, m ? (m[metric] as number | null) : null);
  return (
    <Card className="p-4 sm:p-5">
      {unavailable.length > 0 && (
        <div className="text-xs text-textFaint mb-3">
          {data.dimensionLabel} isn’t available for {unavailable.map((m) => m.title).join(', ')} for this selection (show-level detail is published from mid-December 2025).
        </div>
      )}
      {data.rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-textFaint">No rows for this selection.</div>
      ) : (
        <div className="overflow-x-auto -mx-1 rounded-xl border border-border">
          <table className="w-full text-xs border-collapse min-w-[480px]">
            <thead>
              <tr className="bg-white/[0.03] border-b-2 border-gold">
                <th className="text-left mdtype-overline py-2.5 px-3 text-textFaint">{data.dimensionLabel}</th>
                {data.movies.map((m, i) => (
                  <th key={m.slug} className={`text-right py-2.5 px-3 font-bold ${movieTextClass(i)}`}>
                    {m.title} · {METRIC_LABELS[metric]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, ri) => (
                <tr key={r.key} className={`border-b border-border last:border-b-0 ${ri % 2 ? 'bg-white/[0.015]' : ''}`}>
                  <td className="py-2.5 px-3">
                    <div className="text-text font-semibold truncate max-w-[280px]">{r.name}</div>
                    {r.sub && <div className="text-textFaint text-[10px] truncate max-w-[280px]">{r.sub}</div>}
                  </td>
                  {r.values.map((v, i) => (
                    <td key={i} className="py-2.5 px-3 text-right tabular-nums font-stat font-bold text-[13px] text-textDim">
                      {data.breakdownAvailable[i] ? val(v) : 'n/a'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px] text-textFaint">
        <span>
          Showing {data.rows.length} of {data.totalRows}
        </span>
        <span className="flex gap-2">
          {([5, 10, 'all'] as const).map((l) => (
            <button key={String(l)} type="button" onClick={() => setLimit(l)} className={limit === l ? 'text-gold font-semibold' : 'hover:text-text'}>
              {l === 'all' ? 'All' : `Top ${l}`}
            </button>
          ))}
        </span>
      </div>
    </Card>
  );
}
