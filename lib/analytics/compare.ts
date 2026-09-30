// Movie vs movie comparison view model -- the single source for the Movie
// Comparison page AND the comparison poster. Pure given its inputs
// (buildComparison), plus a loader that fetches those inputs.
import { firstNDays, loadBreakdown, loadMovieAnalytics, resolveSelection, selectionLabel, selectionSummary, DIMENSION_LABELS } from './load';
import { metricValue, sumMetrics } from './metrics';
import type { Breakdown, Comparison, ComparisonMovie, Dimension, MetricKey, Metrics, MovieAnalytics } from './types';
import { contextLine, type CompareRequest } from './query';

export { compareQuery, contextLine, parseCompareParams, parseSelection, parseTerritory, type CompareRequest } from './query';
import { loadUsaAnalytics, loadUsaBreakdown, usSelectionSummary } from './usa';

// Trend points Day 1..N for one metric: each movie's own release days,
// daily or running (cumulative) values. Running values are exactly
// "First N days" (firstNDays): Day 1..N, pre-release excluded.
export function trendSeries(movies: MovieAnalytics[], metric: MetricKey, cumulative: boolean, maxDay: number): { day: number; values: (number | null)[] }[] {
  const points: { day: number; values: (number | null)[] }[] = [];
  for (let day = 1; day <= maxDay; day++) {
    points.push({
      day,
      values: movies.map((m) => {
        if (m.carriedOver) return null;
        const target = m.days.find((d) => d.day === day);
        if (!target) return null;
        if (!cumulative) return metricValue(target.metrics, metric);
        const upto = firstNDays(m, day) ?? [];
        return metricValue(sumMetrics(upto.map((d) => d.metrics)), metric);
      })
    });
  }
  return points;
}

// Lines the breakdown rows of several movies up by key. Order: by the
// first movie's metric (desc), then rows only the others have, by their
// value. `limit` is applied AFTER merging, so every shown row carries every
// movie's real value (never a gap caused by truncating one side first).
export function mergeBreakdowns(breakdowns: (Breakdown | null)[], metric: MetricKey, limit: number | 'all', ordered: boolean) {
  const keys: string[] = [];
  const meta = new Map<string, { name: string; sub: string | null }>();
  const values = new Map<string, (Metrics | null)[]>();
  breakdowns.forEach((b, i) => {
    if (!b || !b.available) return;
    for (const r of b.rows) {
      if (!values.has(r.key)) {
        values.set(r.key, breakdowns.map(() => null));
        meta.set(r.key, { name: r.name, sub: r.sub });
        keys.push(r.key);
      }
      values.get(r.key)![i] = r.metrics;
    }
  });
  let sorted = keys;
  if (!ordered) {
    const score = (k: string) => {
      const v = values.get(k)!;
      for (let i = 0; i < v.length; i++) {
        const x = metricValue(v[i], metric);
        if (x != null) return [i, -x] as const;
      }
      return [v.length, 0] as const;
    };
    sorted = [...keys].sort((a, b) => {
      const [ia, va] = score(a);
      const [ib, vb] = score(b);
      return ia - ib || va - vb || a.localeCompare(b);
    });
  }
  const rows = sorted.map((k) => ({ key: k, name: meta.get(k)!.name, sub: meta.get(k)!.sub, values: values.get(k)! }));
  return { rows: limit === 'all' ? rows : rows.slice(0, limit), totalRows: rows.length };
}

const ORDERED_DIMENSIONS: Dimension[] = ['show_hour', 'time_slot', 'price_band'];

export async function getComparison(req: CompareRequest): Promise<Comparison> {
  const slugs = req.slugs.slice(0, 4);
  const us = req.territory === 'US';
  const loaded = await Promise.all(slugs.map((s) => (us ? loadUsaAnalytics(s) : loadMovieAnalytics(s))));
  const movies = loaded.filter((m): m is MovieAnalytics => !!m);
  const metric = req.metric ?? 'gross';
  const sel = req.selection;

  const resolved = movies.map((m) => resolveSelection(m, sel));
  const summaries = await Promise.all(movies.map((m, i) => (us ? usSelectionSummary(m, resolved[i]) : selectionSummary(m, resolved[i]))));

  const cmpMovies: ComparisonMovie[] = movies.map((m, i) => ({
    slug: m.slug,
    title: m.title,
    poster: m.poster,
    dayOne: m.dayOne,
    dates: resolved[i].points.map((p) => p.date),
    available: resolved[i].points.length > 0,
    reason: resolved[i].reason,
    summary: summaries[i],
    lastUpdated: resolved[i].points[resolved[i].points.length - 1]?.sourceUpdated ?? m.lastUpdated
  }));

  let rows: Comparison['rows'] = [];
  let totalRows = 0;
  let breakdownAvailable: boolean[] = movies.map(() => false);
  let totals: Comparison['totals'] = movies.map(() => null);
  if (req.dimension) {
    const bds = await Promise.all(movies.map((m) => (us ? loadUsaBreakdown(m, sel, req.dimension!) : loadBreakdown(m, sel, req.dimension!))));
    breakdownAvailable = bds.map((b) => b.available);
    totals = bds.map((b) => (b.available ? b.totalRow ?? null : null));
    const merged = mergeBreakdowns(bds, metric, req.limit ?? 'all', ORDERED_DIMENSIONS.includes(req.dimension));
    rows = merged.rows;
    totalRows = merged.totalRows;
  }

  let trend: Comparison['trend'] = null;
  if (req.trend !== false && sel.basis !== 'advance') {
    const maxDay =
      sel.basis === 'lifetime'
        ? Math.min(60, Math.max(0, ...movies.map((m) => Math.max(0, ...m.days.map((d) => d.day ?? 0)))))
        : Math.max(1, sel.day);
    if (maxDay >= 1) trend = { metric, cumulative: sel.basis !== 'day', points: trendSeries(movies, metric, sel.basis !== 'day', maxDay) };
  }

  const updated = cmpMovies.map((m) => m.lastUpdated).filter((x): x is string => !!x).sort();
  return {
    territory: us ? 'US' : 'IN',
    currency: us ? 'USD' : 'INR',
    totals,
    selection: sel,
    context: contextLine(sel, us ? 'US' : 'IN'),
    selectionLabel: selectionLabel(sel),
    movies: cmpMovies,
    dimension: req.dimension ?? null,
    dimensionLabel: req.dimension ? DIMENSION_LABELS[req.dimension] : null,
    breakdownAvailable,
    rows,
    totalRows,
    trend,
    dayOptions: [...new Set(movies.flatMap((m) => m.days.map((d) => d.day).filter((d): d is number => d != null)))].sort((a, b) => a - b),
    advanceDayOptions: [...new Set(movies.flatMap((m) => m.advance.map((d) => d.day).filter((d): d is number => d != null)))].sort((a, b) => a - b),
    lastUpdated: updated[updated.length - 1] ?? null,
    generatedAt: new Date().toISOString()
  };
}

