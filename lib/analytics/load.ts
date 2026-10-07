// Supabase reads for Fyre Analytics. Server-side only (uses the public
// anon client; every table read here is public-read).
import { supabase } from '@/lib/supabaseClient';
import { applyCatalogHistory, publicTrackedSlugs } from '@/lib/tracking';
import { dayNumber, dayOneDate, formatDate, movieState, type BfMovieRow } from '@/lib/bfilmy/adapter';
import { hourOrder, NO_SALES_BAND, PRICE_BANDS, TIME_SLOTS } from '@/lib/bfilmy/detail';
import { makeMetrics, metricsFromTuple, sumMetrics } from './metrics';
import { breakdownTotal } from './totals';
import { formatGross } from './format';
import type { Breakdown, BreakdownRow, DayPoint, Dimension, Metrics, MovieAnalytics, Selection } from './types';

const MOVIE_COLUMNS =
  'slug,title,languages,formats,poster,release_date,premiere_date,carried_over,first_date,last_date,days_tracked,total_gross,total_sold,total_shows,total_seats,latest,best,advance,advance_date,source_updated';

export function todayIST(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function n(v: unknown): number {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

export const DIMENSION_LABELS: Record<Dimension, string> = {
  state: 'State',
  city: 'City',
  language: 'Language',
  language_state: 'Language × State',
  language_city: 'Language × City',
  format: 'Format',
  chain: 'Chain',
  venue: 'Venue',
  time_slot: 'Time slot',
  show_hour: 'Show-start hour',
  price_band: 'Ticket-price band',
  pic: 'PIC (PVR · INOX · Cinepolis)',
  pic_state: 'PIC by state',
  pic_city: 'PIC by city',
  theater: 'Theater',
  format_language: 'Format × Language'
};

// USA-only dimensions (lib/analytics/usa.ts).
export const US_ONLY_DIMENSIONS: Dimension[] = ['theater', 'format_language'];

// Dimensions that only exist where BFILMY's show-level file was imported.
const DETAIL_ONLY: Dimension[] = ['language_state', 'language_city', 'venue', 'time_slot', 'show_hour', 'price_band', 'pic', 'pic_state', 'pic_city'];

const memo = new Map<string, { at: number; value: Promise<unknown> }>();
function remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  memo.set(key, { at: Date.now(), value });
  value.catch(() => memo.delete(key));
  if (memo.size > 500) memo.delete(memo.keys().next().value as string);
  return value;
}

export function cleanSlug(slug: string): string {
  return String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '');
}

async function selectAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(`${label}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// Day 1 for a movie that hasn't released yet is its (advance) release date.
export function releaseDayOne(row: BfMovieRow): string | null {
  return dayOneDate(row) ?? (!row.first_date && !row.carried_over ? row.release_date : null);
}

export function dayFor(date: string, dayOne: string | null, premiere: string | null | undefined): number | null {
  if (!dayOne) return null;
  if (premiere && date === premiere) return 0;
  const d = dayNumber(date, dayOne);
  return d >= 1 ? d : null;
}

function dayLabel(day: number | null, date: string, dayOne: string | null): string {
  if (day === 0) return 'Day 0 (Pre-release)';
  if (day != null) return `Day ${day}`;
  return dayOne && date < dayOne ? 'Pre-release' : formatDate(date);
}

export async function loadMovieAnalytics(slug: string, now: Date = new Date()): Promise<MovieAnalytics | null> {
  const safe = cleanSlug(slug);
  if (!safe) return null;
  // Only movies Fyre tracks (MovieMint's list) exist on Fyre.
  if (!(await publicTrackedSlugs()).has(safe)) return null;
  const today = todayIST(now);
  return remember(`movie:${safe}:${today}`, 60_000, async () => {
    const { data: rowData, error } = await supabase.from('bf_movie').select(MOVIE_COLUMNS).eq('slug', safe).maybeSingle();
    if (error) throw new Error(`bf_movie: ${error.message}`);
    if (!rowData) return null;
    // 90-day rule: a long-running movie Fyre imported only the recent part
    // of is shown like a carried-over one (no Day numbers, tracked period).
    const [row] = await applyCatalogHistory([rowData as BfMovieRow]);

    const [dayRows, detailRows] = await Promise.all([
      selectAll<any>((f, t) => supabase.from('bf_movie_day').select('kind,date,totals,source_updated,breakdown_pruned').eq('slug', safe).order('date').range(f, t), 'bf_movie_day'),
      selectAll<any>(
        (f, t) => supabase.from('bf_movie_day_detail').select('kind,date,shows,seats,sold,gross,ff,hf,venues,cities,states,pic,source_updated').eq('slug', safe).order('date').range(f, t),
        'bf_movie_day_detail'
      )
    ]);
    const detailBy = new Map(detailRows.map((d) => [`${d.kind}:${d.date}`, d]));
    const dayOne = releaseDayOne(row);
    const premiere = row.premiere_date ?? null;

    const toPoint = (r: any): DayPoint => {
      const t = r.totals ?? {};
      const d = detailBy.get(`${r.kind}:${r.date}`);
      const day = dayFor(r.date, dayOne, premiere);
      const final = r.kind === 'boxoffice' ? r.date < today : r.date <= today;
      return {
        date: r.date,
        day,
        label: dayLabel(day, r.date, dayOne),
        final,
        detail: !!d,
        breakdowns: !r.breakdown_pruned,
        sourceUpdated: r.source_updated ?? d?.source_updated ?? null,
        // Day totals always come from BFILMY's summary file -- the same
        // figures every listing, card and bf_movie total uses. The
        // show-level file adds venues, states and PIC (for a finished day
        // the two files match exactly; on a live day the show-level
        // snapshot can be a few minutes apart until the next sync).
        metrics: makeMetrics({
          gross: n(t.gross),
          tickets: n(t.sold),
          shows: n(t.shows),
          seats: n(t.totalSeats),
          ff: t.fastfilling,
          hf: t.housefull,
          cities: d ? d.cities : t.cities,
          venues: d ? d.venues : null,
          states: d ? d.states : null,
          picGross: d ? d.pic?.gross : null,
          picTickets: d ? d.pic?.sold : null
        })
      };
    };

    const days = dayRows.filter((r) => r.kind === 'boxoffice').map(toPoint);
    const advance = dayRows.filter((r) => r.kind === 'advance').map(toPoint);

    const lifetime = sumMetrics(days.map((d) => d.metrics));
    const complete = days.length > 0 && days.every((d) => d.detail);
    if (complete) {
      const total = await rollup(safe, 'boxoffice', days.map((d) => d.date), 'total');
      const t = total.rows[0];
      if (t) Object.assign(lifetime, { venues: n(t[7]), cities: n(t[8]), states: n(t[9]) });
    }

    return {
      slug: row.slug,
      title: row.title,
      poster: row.poster,
      languages: row.languages ?? [],
      formats: row.formats ?? [],
      state: movieState(row, today),
      dayOne,
      premiereDate: premiere,
      carriedOver: !!row.carried_over,
      historyStart: row.carried_over ? row.history_start ?? row.first_date ?? null : null,
      latestDay: days[days.length - 1] ?? null,
      days,
      advance,
      lifetime: { ...lifetime, days: days.length, complete },
      lastUpdated: row.source_updated ?? null
    };
  });
}

// ---------------------------------------------------------------------------
// Selections
// ---------------------------------------------------------------------------

// "Lifetime" only when every movie's full run is stored; a tracked period
// (carried over, or only the recent part imported) is never called lifetime.
export function selectionLabel(s: Selection, movies: Pick<MovieAnalytics, 'carriedOver'>[] = []): string {
  if (s.basis === 'lifetime') return movies.some((m) => m.carriedOver) ? 'Total tracked' : 'Lifetime';
  if (s.basis === 'cumulative') return s.day === 1 ? 'First 1 day' : `First ${s.day} days`;
  if (s.basis === 'advance') return `Advance · Day ${s.day}`;
  return s.day === 0 ? 'Day 0 (Pre-release)' : `Day ${s.day}`;
}

export function sinceText(m: Pick<MovieAnalytics, 'historyStart'>): string {
  return `Tracked since ${formatDate(m.historyStart ?? '2025-01-01')}`;
}

export type Resolved = { kind: 'boxoffice' | 'advance'; points: DayPoint[]; reason: string | null };

// "First N days" for one movie: its release days Day 1..N (Day N itself must
// be tracked; null otherwise). Pre-release dates -- Day 0 and any stray
// earlier shows -- are excluded. The ONE definition used by the comparison,
// the poster, the trend chart and the movie page.
export function firstNDays(m: MovieAnalytics, n: number): DayPoint[] | null {
  const target = m.days.find((d) => d.day === n);
  if (!target || n < 1) return null;
  return m.days.filter((d) => d.day != null && d.day >= 1 && d.date <= target.date);
}

// Which stored days make up a selection for one movie. Release-relative:
// "Day 3" is always the movie's own third release day, never a calendar
// date shared with another movie.
export function resolveSelection(m: MovieAnalytics, s: Selection): Resolved {
  if (s.basis === 'lifetime') {
    return { kind: 'boxoffice', points: m.days, reason: m.days.length ? (m.carriedOver ? `${sinceText(m)} — not full lifetime` : null) : 'No box office tracked yet' };
  }
  if (m.carriedOver) return { kind: 'boxoffice', points: [], reason: `Released before tracking began (${formatDate(m.historyStart ?? '2025-01-01')}); release days unknown` };
  if (s.basis === 'advance') {
    const p = m.advance.find((a) => a.day === s.day);
    return { kind: 'advance', points: p ? [p] : [], reason: p ? null : `No advance snapshot for Day ${s.day}` };
  }
  const target = m.days.find((d) => d.day === s.day);
  if (!target) return { kind: 'boxoffice', points: [], reason: `Not tracked for Day ${s.day}` };
  if (s.basis === 'day') return { kind: 'boxoffice', points: [target], reason: null };
  const points = firstNDays(m, s.day);
  return points ? { kind: 'boxoffice', points, reason: null } : { kind: 'boxoffice', points: [], reason: `Not tracked for Day ${s.day}` };
}

export async function selectionSummary(m: MovieAnalytics, r: Resolved): Promise<Metrics | null> {
  if (r.points.length === 0) return null;
  if (r.points.length === 1) return r.points[0].metrics;
  if (r.kind === 'boxoffice' && r.points.length === m.days.length && m.lifetime.days === r.points.length) {
    const { days: _d, complete: _c, ...rest } = m.lifetime;
    return rest;
  }
  const sum = sumMetrics(r.points.map((p) => p.metrics));
  if (r.points.every((p) => p.detail)) {
    const total = await rollup(m.slug, r.kind, r.points.map((p) => p.date), 'total');
    const t = total.rows[0];
    if (t) Object.assign(sum, { venues: n(t[7]), cities: n(t[8]), states: n(t[9]) });
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Breakdowns
// ---------------------------------------------------------------------------

type RpcResult = { days: number; total: number; rows: unknown[][] };

async function rpc(name: string, args: Record<string, unknown>): Promise<RpcResult> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  const d = (data ?? {}) as Partial<RpcResult>;
  return { days: n(d.days), total: n(d.total), rows: (d.rows ?? []) as unknown[][] };
}

function rollup(slug: string, kind: string, dates: string[], by: string, picOnly = false) {
  return rpc('bf_venue_rollup', { p_slug: slug, p_kind: kind, p_dates: dates, p_by: by, p_pic_only: picOnly });
}
function dimSum(slug: string, kind: string, dates: string[], dimension: string) {
  return rpc('bf_dim_sum', { p_slug: slug, p_kind: kind, p_dates: dates, p_dimension: dimension });
}
function summarySum(slug: string, kind: string, dates: string[], list: string) {
  return rpc('bf_summary_dim_sum', { p_slug: slug, p_kind: kind, p_dates: dates, p_list: list });
}

const s = (v: unknown) => (v == null ? '' : String(v));

function hourLabel(h: number): string {
  const suffix = h < 12 ? 'AM' : 'PM';
  const x = h % 12 === 0 ? 12 : h % 12;
  return `${x} ${suffix}`;
}

export async function loadBreakdown(m: MovieAnalytics, sel: Selection, dimension: Dimension): Promise<Breakdown> {
  const r = resolveSelection(m, sel);
  const dates = r.points.map((p) => p.date);
  const base = { dimension, label: DIMENSION_LABELS[dimension], dates };
  if (US_ONLY_DIMENSIONS.includes(dimension)) return { ...base, available: false, reason: 'Only available for the USA.', source: null, total: 0, rows: [] };
  if (r.points.length === 0) return { ...base, available: false, reason: r.reason, source: null, total: 0, rows: [] };
  if (r.points.some((p) => !p.breakdowns)) {
    return {
      ...base,
      available: false,
      reason: 'Breakdowns are kept for the most recent 90 days. Totals for every day are kept permanently.',
      source: null,
      total: 0,
      rows: []
    };
  }
  const allDetail = r.points.every((p) => p.detail);
  if (DETAIL_ONLY.includes(dimension) && !allDetail) {
    return {
      ...base,
      available: false,
      reason: 'Show-level detail isn’t available for every date in this selection (it exists from mid-December 2025).',
      source: null,
      total: 0,
      rows: []
    };
  }
  const single = dates.length === 1;
  const kind = r.kind;
  let rows: BreakdownRow[] = [];
  let source: Breakdown['source'] = allDetail ? 'show-level' : 'summary';
  let total = 0;

  const fromRollup = async (by: string, picOnly = false) => {
    const res = await rollup(m.slug, kind, dates, by, picOnly);
    total = res.total;
    return res.rows;
  };

  switch (dimension) {
    case 'state':
    case 'city':
    case 'chain': {
      if (allDetail) {
        const tuples = await fromRollup(dimension);
        rows = tuples.map((t) => {
          const k = t[0] as unknown[];
          const metrics = metricsFromTuple(t, { states: null });
          if (dimension === 'city') return { key: `city:${s(k[0])}|${s(k[1])}`, name: s(k[0]), sub: s(k[1]) || null, metrics };
          return { key: `${dimension}:${s(k[0])}`, name: s(k[0]), sub: null, metrics };
        });
      } else {
        const list = dimension === 'state' ? 'states' : dimension === 'city' ? 'cities' : 'chains';
        const res = await summarySum(m.slug, kind, dates, list);
        total = res.total;
        rows = res.rows.map((t) => {
          const k = t[0] as unknown[];
          const metrics = metricsFromTuple(t);
          if (dimension === 'city') return { key: `city:${s(k[0])}|${s(k[1])}`, name: s(k[0]), sub: s(k[1]) || null, metrics };
          return { key: `${dimension}:${s(k[0])}`, name: s(k[0]), sub: null, metrics };
        });
      }
      break;
    }
    case 'language':
    case 'format': {
      if (allDetail) {
        const res = await dimSum(m.slug, kind, dates, dimension);
        total = res.total;
        rows = res.rows.map((t) => ({ key: `${dimension}:${s((t[0] as unknown[])[0])}`, name: s((t[0] as unknown[])[0]), sub: null, metrics: metricsFromTuple(t) }));
      } else {
        const res = await summarySum(m.slug, kind, dates, dimension === 'language' ? 'languages' : 'formats');
        total = res.total;
        rows = res.rows.map((t) => ({ key: `${dimension}:${s((t[0] as unknown[])[0])}`, name: s((t[0] as unknown[])[0]), sub: null, metrics: metricsFromTuple(t) }));
      }
      break;
    }
    case 'language_state':
    case 'language_city': {
      const res = await dimSum(m.slug, kind, dates, dimension);
      total = res.total;
      rows = res.rows.map((t) => {
        const k = t[0] as unknown[];
        return dimension === 'language_state'
          ? { key: `ls:${s(k[0])}|${s(k[1])}`, name: s(k[1]), sub: s(k[0]), metrics: metricsFromTuple(t) }
          : { key: `lc:${s(k[0])}|${s(k[1])}|${s(k[2])}`, name: s(k[1]), sub: `${s(k[0])} · ${s(k[2])}`, metrics: metricsFromTuple(t) };
      });
      break;
    }
    case 'venue': {
      const tuples = await fromRollup('venue');
      rows = tuples.map((t) => {
        const k = t[0] as unknown[];
        return { key: `venue:${s(k[0])}`, name: s(k[1]), sub: `${s(k[2])}, ${s(k[3])}${k[4] && k[4] !== 'Unknown' ? ` · ${s(k[4])}` : ''}`, metrics: metricsFromTuple(t, { venues: null, cities: null }) };
      });
      break;
    }
    case 'pic': {
      const [chains, totalRes] = await Promise.all([fromRollup('chain', true), rollup(m.slug, kind, dates, 'total', true)]);
      rows = chains.map((t) => ({ key: `chain:${s((t[0] as unknown[])[0])}`, name: s((t[0] as unknown[])[0]), sub: null, metrics: metricsFromTuple(t) }));
      const tt = totalRes.rows[0];
      if (tt) rows.unshift({ key: 'pic:total', name: 'PIC total', sub: null, metrics: metricsFromTuple(tt) });
      total = rows.length;
      break;
    }
    case 'pic_state':
    case 'pic_city': {
      const tuples = await fromRollup(dimension === 'pic_state' ? 'state' : 'city', true);
      rows = tuples.map((t) => {
        const k = t[0] as unknown[];
        return dimension === 'pic_city'
          ? { key: `city:${s(k[0])}|${s(k[1])}`, name: s(k[0]), sub: s(k[1]) || null, metrics: metricsFromTuple(t) }
          : { key: `state:${s(k[0])}`, name: s(k[0]), sub: null, metrics: metricsFromTuple(t) };
      });
      break;
    }
    case 'show_hour':
    case 'time_slot': {
      const res = await dimSum(m.slug, kind, dates, 'show_hour');
      const byHour = new Map(res.rows.map((t) => [n((t[0] as unknown[])[0]), t]));
      const hours = [...byHour.keys()].sort((a, b) => hourOrder(a) - hourOrder(b));
      if (dimension === 'show_hour') {
        const running: Metrics[] = [];
        rows = hours.map((h) => {
          const t = byHour.get(h)!;
          const metrics = metricsFromTuple(t);
          running.push(metrics);
          const cumulative = sumMetrics(running);
          if (single) Object.assign(cumulative, { venues: t[9] == null ? null : n(t[9]), cities: t[10] == null ? null : n(t[10]) });
          return { key: `hour:${h}`, name: hourLabel(h), sub: null, metrics, cumulative };
        });
      } else {
        rows = TIME_SLOTS.map((slot) => {
          const parts = slot.hours.filter((h) => byHour.has(h)).map((h) => metricsFromTuple(byHour.get(h)!));
          const metrics = sumMetrics(parts.length ? parts : [makeMetrics({ gross: 0, tickets: 0, shows: 0, seats: 0, ff: 0, hf: 0 })]);
          return { key: `slot:${slot.label}`, name: slot.label, sub: null, metrics: { ...metrics, venues: null, cities: null, states: null } };
        });
      }
      total = rows.length;
      break;
    }
    case 'price_band': {
      const res = await dimSum(m.slug, kind, dates, 'price_band');
      const order = [...PRICE_BANDS.map((b) => b.label), NO_SALES_BAND];
      rows = res.rows
        .map((t) => ({ key: `band:${s((t[0] as unknown[])[0])}`, name: s((t[0] as unknown[])[0]), sub: null, metrics: metricsFromTuple(t) }))
        .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
      total = rows.length;
      break;
    }
  }
  // TOTAL row, reconciled with the selection's headline (summary file).
  const headline = await selectionSummary(m, r);
  const pic = dimension === 'pic' || dimension === 'pic_state' || dimension === 'pic_city';
  const totalRow = breakdownTotal(
    rows.filter((x) => x.key !== 'pic:total'),
    headline,
    {
      exhaustive: true,
      subset: pic ? 'pic' : undefined,
      mayBeIncomplete: source === 'summary',
      live: r.points.some((p) => !p.final),
      money: formatGross
    }
  );
  return { ...base, currency: 'INR', available: true, reason: null, source, total: total || rows.length, rows, totalRow };
}

export function isDetailOnly(d: Dimension): boolean {
  return DETAIL_ONLY.includes(d);
}
