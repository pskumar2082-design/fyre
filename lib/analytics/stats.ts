// Movie Stats dashboard: server-side loaders (Supabase reads only; public
// traffic never contacts a source site). Aggregation happens here or in
// SQL; the browser receives one page of rows at a time.
import { supabase } from '@/lib/supabaseClient';
import { moviemintIndia } from '@/lib/sourcePolicy';
import { publicTrackedSlugs } from '@/lib/tracking';
import { breakdownForResolved, loadMovieAnalytics, todayIST, type Resolved } from './load';
import { loadUsaAdvanceTrend, loadUsaAnalytics, usaBreakdownForResolved } from './usa';
import { buildStats, pageOf, pointsInRange, sortRows, type MovieStats, type StatsColumn, type StatsDimension, type StatsRow } from './statsModel';
import type { BreakdownRow, Dimension, Metrics, MovieAnalytics, Territory } from './types';

const db = supabase as any;
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : null;
};
const r2 = (v: number) => Math.round(v * 100) / 100;
const ymd = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

const memo = new Map<string, { at: number; value: Promise<unknown> }>();
function remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  memo.set(key, { at: Date.now(), value });
  value.catch(() => memo.delete(key));
  if (memo.size > 400) memo.delete(memo.keys().next().value as string);
  return value;
}

export async function loadAnalyticsFor(slug: string, territory: Territory): Promise<MovieAnalytics | null> {
  return territory === 'US' ? loadUsaAnalytics(slug) : loadMovieAnalytics(slug);
}

export function statsFrom(m: MovieAnalytics, now: Date = new Date()): MovieStats {
  return buildStats(m, todayIST(now), { moviemint: moviemintIndia() });
}

export async function loadMovieStats(slug: string, territory: Territory): Promise<MovieStats | null> {
  const m = await loadAnalyticsFor(slug, territory);
  return m ? statsFrom(m) : null;
}

// ---------------------------------------------------------------------------
// Breakdowns over a date range
// ---------------------------------------------------------------------------

export type StatsBreakdownRequest = {
  slug: string;
  territory: Territory;
  dimension: StatsDimension;
  kind: 'boxoffice' | 'advance';
  from: string | null;
  to: string | null;
  window: 'tracked' | 'later' | 'all';
  date: string | null; // advance show date
  state: string | null;
  format: string | null;
  sort: StatsColumn | 'name';
  dir: 'asc' | 'desc';
  offset: number;
  limit: number;
};

export type StatsBreakdown = {
  dimension: StatsDimension;
  available: boolean;
  reason: string | null;
  columns: StatsColumn[];
  dates: string[];
  coverage: { withBreakdown: number; inRange: number; missing: string[] };
  total: number; // rows before paging
  offset: number;
  rows: StatsRow[];
  totals: Partial<Record<StatsColumn, number | null>> | null; // over every row (top-level only for nested lists)
  totalStatus: 'MATCH' | 'MISMATCH' | 'PARTIAL' | null;
  totalNote: string | null;
  states: string[]; // filter options
  formats: string[];
  live: boolean;
};

const STD: Partial<Record<StatsDimension, Dimension>> = { state: 'state', city: 'city', language: 'language', format: 'format', chain: 'chain', theater: 'theater', format_language: 'format_language' };

function valuesOf(m: Metrics, shareBase: number, extra: Partial<Record<StatsColumn, number | null>> = {}): Partial<Record<StatsColumn, number | null>> {
  const seats = m.seats > 0 ? m.seats : null;
  return {
    gross: m.gross,
    share: shareBase > 0 ? r2((m.gross / shareBase) * 100) : null,
    tickets: m.tickets,
    shows: m.shows,
    seats,
    occupancy: m.occupancy,
    atp: m.atp,
    venues: m.venues,
    cities: m.cities,
    ff: m.ff,
    hf: m.hf,
    ...extra
  };
}

function columnsFor(dimension: StatsDimension, territory: Territory, mm: boolean): StatsColumn[] {
  if (dimension === 'city_format') return ['gross', 'share'];
  const base: StatsColumn[] = ['gross', 'share', 'tickets', 'shows'];
  if (territory === 'US') return [...base, 'seats', 'occupancy', 'atp', ...(dimension === 'theater' ? [] : (['venues'] as StatsColumn[]))];
  if (dimension === 'language' || dimension === 'format') return mm ? [...base, 'occupancySource', 'atp'] : [...base, 'seats', 'occupancy', 'atp', 'ff', 'hf'];
  return [...base, 'seats', 'occupancy', 'atp', 'venues', 'ff', 'hf'];
}

const unavailable = (req: StatsBreakdownRequest, reason: string, dates: string[] = []): StatsBreakdown => ({
  dimension: req.dimension,
  available: false,
  reason,
  columns: [],
  dates,
  coverage: { withBreakdown: 0, inRange: dates.length, missing: [] },
  total: 0,
  offset: 0,
  rows: [],
  totals: null,
  totalStatus: null,
  totalNote: null,
  states: [],
  formats: [],
  live: false
});

export async function loadStatsBreakdown(req: StatsBreakdownRequest): Promise<StatsBreakdown> {
  const m = await loadAnalyticsFor(req.slug, req.territory);
  if (!m) return unavailable(req, 'Movie not found');
  const stats = statsFrom(m);
  const avail = stats.dimensions.find((d) => d.key === req.dimension);
  if (!avail) return unavailable(req, 'Not available for this territory');
  if (!avail.available) return unavailable(req, avail.reason ?? 'Not available');
  const mm = req.territory === 'IN' && moviemintIndia();

  // Which stored days
  let inRange;
  if (req.kind === 'advance') {
    inRange = stats.advanceAll.filter((a) => (req.date ? a.date === req.date : a.date === stats.advance[0]?.date));
  } else {
    inRange = pointsInRange(stats.points, req.from, req.to, req.window);
  }
  if (!inRange.length) return unavailable(req, req.kind === 'advance' ? 'No advance bookings for this show date' : 'No tracked days in this range');
  const withBd = inRange.filter((p) => p.breakdowns);
  const missing = inRange.filter((p) => !p.breakdowns).map((p) => p.date);
  if (!withBd.length) return { ...unavailable(req, 'No breakdown is stored for these dates yet. Day totals are shown in the daily table.', inRange.map((p) => p.date)), coverage: { withBreakdown: 0, inRange: inRange.length, missing } };
  const dates = withBd.map((p) => p.date);
  const resolved: Resolved = {
    kind: req.kind,
    points: (req.kind === 'advance' ? m.advance.filter((d) => dates.includes(d.date)) : [...m.days, ...(m.laterDays ?? [])].filter((d) => dates.includes(d.date))).sort((a, b) => a.date.localeCompare(b.date)),
    reason: null
  };
  const live = withBd.some((p) => !p.final);
  const columns = columnsFor(req.dimension, req.territory, mm);
  let rows: StatsRow[] = [];
  let totals: StatsBreakdown['totals'] = null;
  let totalStatus: StatsBreakdown['totalStatus'] = null;
  let totalNote: string | null = null;
  let states: string[] = [];
  let formats: string[] = [];

  let terrMissing: string[] = [];
  if (req.dimension === 'territory') {
    const { rows: t, days: terrDays } = await territoryRows(req.slug, req.kind, dates);
    terrMissing = dates.filter((d) => !terrDays.has(d));
    if (!terrDays.size) return { ...unavailable(req, 'No AP / TS territory split is stored for these dates (the source publishes it only for some dates).', dates), coverage: { withBreakdown: 0, inRange: inRange.length, missing: [...missing, ...terrMissing].sort() } };
    const top = t.filter((r) => !r.nested);
    const base = top.reduce((a, r) => a + (r.values.gross ?? 0), 0);
    rows = t.map((r) => ({ ...r, values: { ...r.values, share: base > 0 ? r2(((r.values.gross ?? 0) / base) * 100) : null } }));
    totals = { gross: r2(base), tickets: top.reduce((a, r) => a + (r.values.tickets ?? 0), 0), shows: top.reduce((a, r) => a + (r.values.shows ?? 0), 0), share: 100 };
    totalStatus = 'PARTIAL';
    totalNote = `Andhra Pradesh and Telangana only. Sub-regions are already inside their parent territory and are not added again.${terrMissing.length ? ` The territory split exists for ${terrDays.size} of ${dates.length} days in this range; the other days are not included.` : ''}`;
  } else if (req.dimension === 'city_format') {
    const { data, error } = await db.rpc('mmi_city_format_sum', { p_slug: req.slug, p_kind: req.kind, p_dates: dates, p_state: req.state, p_format: req.format });
    if (error) return unavailable(req, /function|does not exist|schema cache/i.test(error.message) ? 'City × Format split becomes available after the next data update.' : error.message, dates);
    const list = ((data?.rows ?? []) as unknown[][]).map((r) => ({ city: String(r[0]), state: String(r[1] ?? ''), format: String(r[2]), gross: num(r[3]) ?? 0 }));
    const base = list.reduce((a, r) => a + r.gross, 0);
    rows = list.map((r) => ({ key: `cf:${r.city}|${r.state}|${r.format}`, name: r.city, sub: `${r.format} · ${r.state}`, values: { gross: r.gross, share: base > 0 ? r2((r.gross / base) * 100) : null } }));
    totals = { gross: r2(base), share: 100 };
    totalStatus = 'PARTIAL';
    totalNote = 'Gross only: tickets and shows are not split by format within a city.';
    formats = [...new Set(list.map((r) => r.format))].sort();
    states = [...new Set(list.map((r) => r.state).filter(Boolean))].sort();
  } else {
    const dim = STD[req.dimension]!;
    const b = req.territory === 'US' ? await usaBreakdownForResolved(m, resolved, dim) : await breakdownForResolved(m, resolved, dim);
    if (!b.available) return { ...unavailable(req, b.reason ?? 'Not available', dates), coverage: { withBreakdown: withBd.length, inRange: inRange.length, missing } };
    const base = b.rows.reduce((a, r) => a + r.metrics.gross, 0);
    // MovieMint language / format rows carry the source's own occupancy
    // (no seats): kept as occupancySource, never as tickets / seats.
    const srcOcc = mm && (req.dimension === 'language' || req.dimension === 'format') && dates.length === 1 ? await sourceOccupancy(req.slug, req.kind, dates[0], req.dimension) : null;
    rows = b.rows.map((r: BreakdownRow) => ({ key: r.key, name: r.name, sub: r.sub, values: valuesOf(r.metrics, base, srcOcc ? { occupancySource: srcOcc.get(r.name) ?? null } : {}) }));
    if (req.dimension === 'city') states = [...new Set(rows.map((r) => r.sub ?? '').filter(Boolean))].sort();
    const t = b.totalRow;
    if (t?.metrics) totals = valuesOf(t.metrics, base, { share: 100 });
    else totals = { gross: r2(base), share: 100 };
    totalStatus = t?.status ?? null;
    totalNote = t?.note ?? null;
  }

  if (req.state && req.dimension === 'city') rows = rows.filter((r) => r.sub === req.state);
  rows = req.dimension === 'territory' ? rows : sortRows(rows, req.sort, req.dir);
  return {
    dimension: req.dimension,
    available: true,
    reason: null,
    columns,
    dates,
    coverage: { withBreakdown: withBd.length - terrMissing.length, inRange: inRange.length, missing: [...missing, ...terrMissing].sort() },
    total: rows.length,
    offset: req.offset,
    rows: pageOf(rows, req.offset, req.limit),
    totals,
    totalStatus,
    totalNote,
    states,
    formats,
    live
  };
}

// AP / TS trade territories over several dates. Sub-regions are nested
// inside a parent: listed, flagged, never added to the total.
async function territoryRows(slug: string, kind: string, dates: string[]): Promise<{ rows: StatsRow[]; days: Set<string> }> {
  const { data, error } = await db.from('mmi_movie_day').select('date,terr:breakdown->territories').eq('slug', slug).eq('kind', kind).in('date', dates);
  if (error) throw new Error(`mmi_movie_day: ${error.message}`);
  const acc = new Map<string, { name: string; sub: boolean; gross: number; sold: number; shows: number; seats: number | null; ff: number | null; hf: number | null; venues: number | null; n: number }>();
  const days = new Set<string>();
  for (const d of data ?? []) {
    if (((d.terr ?? []) as any[]).length) days.add(d.date);
    for (const t of (d.terr ?? []) as any[]) {
      const name = String(t?.name ?? '');
      if (!name) continue;
      const e = acc.get(name) ?? { name, sub: !!t.subRegion, gross: 0, sold: 0, shows: 0, seats: 0, ff: 0, hf: 0, venues: null, n: 0 };
      e.gross += num(t.gross) ?? 0;
      e.sold += num(t.sold) ?? 0;
      e.shows += num(t.shows) ?? 0;
      e.seats = e.seats == null || num(t.totalSeats) == null ? null : e.seats + (num(t.totalSeats) as number);
      e.ff = e.ff == null || num(t.fastfilling) == null ? null : e.ff + (num(t.fastfilling) as number);
      e.hf = e.hf == null || num(t.housefull) == null ? null : e.hf + (num(t.housefull) as number);
      e.venues = dates.length === 1 ? num(t.venues) : null;
      e.n++;
      acc.set(name, e);
    }
  }
  const list = [...acc.values()];
  const top = list.filter((e) => !e.sub).sort((a, b) => b.gross - a.gross);
  const subs = list.filter((e) => e.sub).sort((a, b) => b.gross - a.gross);
  const parentOf = (s: string) => top.find((p) => s.toLowerCase().startsWith(p.name.toLowerCase()))?.name ?? null;
  const row = (e: (typeof list)[number], nested: boolean): StatsRow => ({
    key: `territory:${e.name}`,
    name: e.name,
    sub: nested ? `inside ${parentOf(e.name) ?? 'its parent territory'}` : null,
    nested,
    values: {
      gross: r2(e.gross),
      tickets: e.sold,
      shows: e.shows,
      seats: e.seats && e.seats > 0 ? e.seats : null,
      occupancy: e.seats && e.seats > 0 ? r2((e.sold / e.seats) * 100) : null,
      atp: e.sold > 0 ? r2(e.gross / e.sold) : null,
      venues: e.venues,
      ff: e.ff,
      hf: e.hf
    }
  });
  const out: StatsRow[] = [];
  for (const p of top) {
    out.push(row(p, false));
    for (const s of subs.filter((x) => parentOf(x.name) === p.name)) out.push(row(s, true));
  }
  for (const s of subs.filter((x) => !parentOf(x.name))) out.push(row(s, true));
  return { rows: out, days };
}

async function sourceOccupancy(slug: string, kind: string, date: string, dimension: 'language' | 'format'): Promise<Map<string, number | null>> {
  const list = dimension === 'language' ? 'languages' : 'formats';
  const { data } = await db.from('mmi_movie_day').select(`l:breakdown->${list}`).eq('slug', slug).eq('kind', kind).eq('date', date).maybeSingle();
  return new Map(((data?.l ?? []) as any[]).map((r) => [String(r?.name ?? ''), num(r?.occupancySource ?? r?.occupancy)]));
}

// ---------------------------------------------------------------------------
// Snapshots: live-day (intraday) and advance build-up
// ---------------------------------------------------------------------------

export type SnapshotPoint = { at: string; label: string; gross: number; tickets: number; shows: number; seats: number | null; occupancy: number | null; occupancySource: number | null; completedAsOf: string | null };
export type StatsSnapshots = { kind: 'boxoffice' | 'advance'; date: string; available: boolean; reason: string | null; cadence: 'refresh' | 'daily' | null; points: SnapshotPoint[] };

// "2026-10-14 20:40 IST" -> "14 Oct 20:40"
function stampLabel(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/.exec(s);
  if (!m) return s;
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1];
  return `${Number(m[3])} ${mon} ${m[4]}`;
}

export async function loadStatsSnapshots(slug: string, territory: Territory, kind: 'boxoffice' | 'advance', date: string | null): Promise<StatsSnapshots> {
  const day = ymd(date) ?? todayIST();
  const no = (reason: string): StatsSnapshots => ({ kind, date: day, available: false, reason, cadence: null, points: [] });
  return remember(`snap:${territory}:${slug}:${kind}:${day}`, 60_000, async () => {
    if (territory === 'US') {
      if (kind === 'boxoffice') return no('Intraday refreshes are not tracked for the USA');
      const trend = await loadUsaAdvanceTrend(slug, day);
      if (!trend?.length) return no('No advance captures for this show date yet');
      return {
        kind,
        date: day,
        available: true,
        reason: null,
        cadence: 'daily',
        points: trend.map((t: any) => ({ at: t.capturedAt ?? t.capturedOn, label: t.capturedOn, gross: t.gross, tickets: t.tickets, shows: t.shows, seats: null, occupancy: null, occupancySource: null, completedAsOf: null }))
      };
    }
    if (!(await publicTrackedSlugs()).has(slug)) return no('Movie not found');
    if (!moviemintIndia()) return no(kind === 'advance' ? 'Advance build-up history is not available for this movie' : 'Intraday history is not available for this movie');
    const { data, error } = await db.rpc('mmi_snapshot_series', { p_slug: slug, p_kind: kind, p_show_date: day });
    if (error) return no(/function|does not exist|schema cache/i.test(error.message) ? 'Refresh history becomes available after the next data update' : error.message);
    const rows = (data ?? []) as any[];
    if (!rows.length) return no(kind === 'advance' ? 'No advance refreshes captured for this show date yet' : 'No refreshes captured for this day yet');
    return {
      kind,
      date: day,
      available: true,
      reason: null,
      cadence: 'refresh',
      points: rows.map((r) => {
        const t = r.totals ?? {};
        return {
          at: r.captured_at,
          label: stampLabel(String(r.source_updated ?? '')),
          gross: num(t.gross) ?? 0,
          tickets: num(t.sold) ?? 0,
          shows: num(t.shows) ?? 0,
          seats: num(t.totalSeats),
          occupancy: num(t.occupancy),
          occupancySource: num(t.occupancySource),
          completedAsOf: r.completed_as_of ?? null
        };
      })
    };
  });
}

export function parseStatsBreakdownRequest(q: URLSearchParams): StatsBreakdownRequest | { error: string } {
  const slug = String(q.get('slug') ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!slug) return { error: 'Missing slug' };
  const dims: StatsDimension[] = ['state', 'city', 'language', 'format', 'territory', 'city_format', 'chain', 'theater', 'format_language'];
  const dimension = q.get('dimension') as StatsDimension;
  if (!dims.includes(dimension)) return { error: 'Unknown dimension' };
  const cols: (StatsColumn | 'name')[] = ['name', 'gross', 'share', 'tickets', 'shows', 'seats', 'occupancy', 'occupancySource', 'atp', 'venues', 'cities', 'ff', 'hf'];
  const sort = (cols.includes(q.get('sort') as StatsColumn) ? q.get('sort') : 'gross') as StatsColumn | 'name';
  const w = q.get('window');
  return {
    slug,
    territory: String(q.get('territory') ?? '').toLowerCase() === 'us' ? 'US' : 'IN',
    dimension,
    kind: q.get('kind') === 'advance' ? 'advance' : 'boxoffice',
    from: ymd(q.get('from')),
    to: ymd(q.get('to')),
    window: w === 'later' || w === 'all' ? w : 'tracked',
    date: ymd(q.get('date')),
    state: q.get('state') || null,
    format: q.get('format') || null,
    sort,
    dir: q.get('dir') === 'asc' ? 'asc' : 'desc',
    offset: Math.max(0, Math.floor(Number(q.get('offset') ?? 0)) || 0),
    limit: Math.min(100, Math.max(1, Math.floor(Number(q.get('limit') ?? 10)) || 10))
  };
}
