'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { TTListedMovie } from '@/lib/boxoffice/types';
import { useMovieCatalog } from '@/lib/compare/useMovieCatalog';
import { compareQuery } from '@/lib/analytics/query';
import { METRIC_LABELS } from '@/lib/analytics/metrics';
import type { Dimension, MetricKey, MovieAnalytics, Selection } from '@/lib/analytics/types';
import MovieSelector from '@/components/compare/MovieSelector';
import { Card } from '@/components/ui';

// Admin → Social poster. Builds an X-ready PNG (Movie Report or Movie
// Comparison) from /api/social-poster/x-compare, which renders the SAME
// Fyre Analytics comparison view model the public Movie Comparison page
// shows -- the poster never computes its own numbers. Movies come from
// the tracked (MovieMint) catalog only.

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

export default function SocialPosterTool() {
  const catalog = useMovieCatalog();
  const [type, setType] = useState<'report' | 'comparison'>('comparison');
  const [a, setA] = useState<TTListedMovie | null>(null);
  const [b, setB] = useState<TTListedMovie | null>(null);
  const [basis, setBasis] = useState<Selection['basis']>('day');
  const [day, setDay] = useState(1);
  const [dimension, setDimension] = useState<Dimension | 'overview'>('state');
  const [metric, setMetric] = useState<MetricKey>('gross');
  const [rows, setRows] = useState<5 | 10 | 'all'>(5);
  const [chart, setChart] = useState(false);
  const [format, setFormat] = useState<'auto' | '1080x1350'>('auto');
  const [watermark, setWatermark] = useState(true);
  const [dayOptions, setDayOptions] = useState<number[]>([]);
  const [advanceOptions, setAdvanceOptions] = useState<number[]>([]);
  const [imgState, setImgState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [imgError, setImgError] = useState<string | null>(null);

  const slugs = [a, type === 'comparison' ? b : null].filter((m): m is TTListedMovie => !!m).map((m) => m.slug);
  const ready = type === 'report' ? slugs.length === 1 : slugs.length === 2;

  // Day pickers offer the days the chosen movies actually have.
  useEffect(() => {
    if (!slugs.length) return;
    let cancelled = false;
    Promise.all(slugs.map((s) => fetch(`/api/analytics/movie/${encodeURIComponent(s)}`).then((r) => (r.ok ? (r.json() as Promise<MovieAnalytics>) : null))))
      .then((list) => {
        if (cancelled) return;
        const ms = list.filter((m): m is MovieAnalytics => !!m);
        setDayOptions([...new Set(ms.flatMap((m) => m.days.map((d) => d.day).filter((x): x is number => x != null)))].sort((x, y) => x - y));
        setAdvanceOptions([...new Set(ms.flatMap((m) => m.advance.map((d) => d.day).filter((x): x is number => x != null)))].sort((x, y) => x - y));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slugs.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const selection: Selection = basis === 'lifetime' ? { basis } : { basis, day };
  const url = useMemo(() => {
    if (!ready) return null;
    const qs = compareQuery({ slugs, selection, dimension: dimension === 'overview' ? null : dimension, metric, limit: rows });
    return `/api/social-poster/x-compare?${qs}${chart ? '&chart=1' : ''}${format !== 'auto' ? `&format=${format}` : ''}${watermark ? '' : '&watermark=0'}`;
  }, [ready, slugs.join(','), basis, day, dimension, metric, rows, chart, format, watermark]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!url) return;
    setImgState('loading');
    setImgError(null);
  }, [url]);

  async function download() {
    if (!url) return;
    const res = await fetch(url);
    if (!res.ok) {
      setImgError(await res.text());
      return;
    }
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'fyre-poster.png';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function explainError() {
    if (!url) return;
    const res = await fetch(url);
    setImgError(res.ok ? null : await res.text());
  }

  const select = 'text-sm bg-surface border border-border rounded-full h-10 px-4 text-text';
  const opts = basis === 'advance' ? advanceOptions : dayOptions.filter((d) => basis !== 'cumulative' || d >= 1);
  const pill = (on: boolean) => `text-xs font-semibold px-3 py-1.5 rounded-full border ${on ? 'bg-gold/[0.12] border-gold/40 text-gold' : 'border-border text-textDim'}`;

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-5">
      <Card className="p-4 flex flex-col gap-4 h-fit">
        <div className="flex gap-1.5">
          <button type="button" className={pill(type === 'report')} onClick={() => setType('report')}>
            Movie Report
          </button>
          <button type="button" className={pill(type === 'comparison')} onClick={() => setType('comparison')}>
            Movie Comparison
          </button>
        </div>
        <MovieSelector movies={catalog.movies} loading={catalog.loading} error={catalog.error} selected={a} onSelect={setA} onClear={a ? () => setA(null) : undefined} excludeSlugs={b ? [b.slug] : []} label="Movie A" />
        {type === 'comparison' && (
          <MovieSelector movies={catalog.movies} loading={catalog.loading} error={catalog.error} selected={b} onSelect={setB} onClear={b ? () => setB(null) : undefined} excludeSlugs={a ? [a.slug] : []} label="Movie B" />
        )}

        <div>
          <div className="mdtype-overline text-textFaint mb-1.5">Comparison basis</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[1, 7, 10, 30].map((n) => (
              <button key={n} type="button" className={pill((n === 1 ? basis === 'day' : basis === 'cumulative') && day === n)} onClick={() => (setBasis(n === 1 ? 'day' : 'cumulative'), setDay(n))}>
                {n === 1 ? 'Day 1' : `First ${n} days`}
              </button>
            ))}
            <button type="button" className={pill(basis === 'lifetime')} onClick={() => setBasis('lifetime')}>
              Lifetime
            </button>
          </div>
          <div className="flex gap-2">
            <select className={select} value={basis} onChange={(e) => setBasis(e.target.value as Selection['basis'])}>
              <option value="day">Tracked day</option>
              <option value="cumulative">Cumulative through day</option>
              <option value="lifetime">Lifetime</option>
              <option value="advance">Advance</option>
            </select>
            {basis !== 'lifetime' && (
              <select className={select} value={day} onChange={(e) => setDay(Number(e.target.value))}>
                {(opts.length ? opts : [day]).map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? 'Day 0' : `Day ${n}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div>
          <div className="mdtype-overline text-textFaint mb-1.5">Breakdown</div>
          <select className={`${select} w-full`} value={dimension} onChange={(e) => setDimension(e.target.value as Dimension | 'overview')}>
            {DIMENSIONS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {type === 'comparison' && (
          <div>
            <div className="mdtype-overline text-textFaint mb-1.5">Metric</div>
            <div className="flex flex-wrap gap-1.5">
              {METRICS.map((m) => (
                <button key={m} type="button" className={pill(metric === m)} onClick={() => setMetric(m)}>
                  {METRIC_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          <div>
            <div className="mdtype-overline text-textFaint mb-1.5">Rows</div>
            <div className="flex gap-1.5">
              {([5, 10, 'all'] as const).map((r) => (
                <button key={String(r)} type="button" className={pill(rows === r)} onClick={() => setRows(r)}>
                  {r === 'all' ? 'All' : `Top ${r}`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mdtype-overline text-textFaint mb-1.5">Size</div>
            <div className="flex gap-1.5">
              <button type="button" className={pill(format === 'auto')} onClick={() => setFormat('auto')}>
                Fit
              </button>
              <button type="button" className={pill(format === '1080x1350')} onClick={() => setFormat('1080x1350')}>
                X 4:5
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-4 text-sm text-textDim">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={chart} onChange={(e) => setChart(e.target.checked)} /> Day 1 → N chart
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} /> Watermark
          </label>
        </div>
        <button type="button" disabled={!url} onClick={download} className="inline-flex items-center justify-center gap-2 bg-gold text-white font-semibold rounded-full h-10 text-sm disabled:opacity-40">
          <Download size={16} /> Download PNG
        </button>
      </Card>

      <div>
        {!url ? (
          <div className="text-sm text-textFaint py-20 text-center border border-dashed border-border rounded-2xl">
            {type === 'report' ? 'Pick a movie.' : 'Pick two movies.'}
          </div>
        ) : (
          <div>
            {imgState === 'loading' && <div className="text-xs text-textFaint mb-2">Rendering…</div>}
            {imgState === 'error' && (
              <div className="text-sm text-red mb-2">
                {imgError ?? 'This poster could not be made for the current selection.'}
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={url}
              src={url}
              alt="Poster preview"
              className={`w-full max-w-[540px] rounded-xl border border-border ${imgState === 'error' ? 'hidden' : ''}`}
              onLoad={() => setImgState('ok')}
              onError={() => {
                setImgState('error');
                explainError();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
