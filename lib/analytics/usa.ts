// USA territory for Fyre Analytics: "USA · Indian-language screenings"
// (BFILMY USA feed, USD). Same view model as India (MovieAnalytics, Breakdown,
// ShowList) so the movie page, comparison and poster use one code path;
// only the loaders differ. See lib/usa for the import and
// supabase/migration_bfilmy_usa.sql for the tables.
//
// Metric origins (us_movie_day.metric_origin): headline gross/tickets/seats
// are sums of the source's show rows (they equal its summary exactly);
// shows = imported rows (the source summary count is kept separately);
// occupancy = tickets / seats (the source's unweighted figure is kept too);
// theatres / cities / states = distinct counts. FF/HF and PIC don't exist
// for the USA: null (shown as N/A), never zero.
import { supabase } from '@/lib/supabaseClient';
import { catalogHistory, publicTrackedSlugs } from '@/lib/tracking';
import { catalogMovie } from '@/lib/catalog/public';
import { formatDate } from '@/lib/bfilmy/adapter';
import { usDayLabel, usToday } from '@/lib/usa/days';
import { makeMetrics, round2, sumMetrics } from './metrics';
import { cleanSlug, DIMENSION_LABELS, resolveSelection, type Resolved } from './load';
import { breakdownTotal } from './totals';
import { formatUsd } from './format';
import type { Breakdown, BreakdownRow, DayPoint, Dimension, Metrics, MovieAnalytics, Selection } from './types';
import type { ShowList, ShowRow } from './shows';

export const US_DIMENSION_LIST: Dimension[] = ['state', 'city', 'theater', 'chain', 'format', 'language', 'format_language'];
const US_DETAIL: Dimension[] = ['city', 'theater'];

const db = supabase as any;
const num = (v: unknown) => {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};
const numOrNull = (v: unknown) => (v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export async function usaMovieId(slug: string): Promise<string | null> {
  const safe = cleanSlug(slug);
  if (!safe || !(await publicTrackedSlugs()).has(safe)) return null;
  const { data, error } = await db.from('fyre_tracked_movie').select('moviemint_id').eq('bf_slug', safe).eq('match_status', 'matched').maybeSingle();
  if (error) throw new Error(`fyre_tracked_movie: ${error.message}`);
  return data?.moviemint_id ?? null;
}

const DAY_COLUMNS =
  'kind,report_date,release_day,final,gross,tickets,seats,shows,shows_source,zero_seat_shows,occupancy,occupancy_source,theatres,cities,states,source_movie_ids,source_url,source_etag,source_seen_at,synced_at,recon,breakdown_pruned,detail_pruned';

function usMetrics(r: any): Metrics {
  const m = makeMetrics({ gross: num(r.gross), tickets: num(r.tickets), shows: num(r.shows), seats: num(r.seats), venues: numOrNull(r.theatres), cities: numOrNull(r.cities), states: numOrNull(r.states) });
  // Stored DERIVED occupancy (zero-seat shows excluded from the denominator).
  if (r.occupancy != null) m.occupancy = round2(Number(r.occupancy));
  return m;
}

// "2026-09-30 12:10 ET": when Fyre first saw this version of the source
// file (the source itself publishes no timestamp).
export function etStamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time} ET`;
}

const memo = new Map<string, { at: number; value: Promise<MovieAnalytics | null> }>();

export async function loadUsaAnalytics(slug: string, now: Date = new Date()): Promise<MovieAnalytics | null> {
  const movieId = await usaMovieId(slug);
  if (!movieId) return null;
  const key = `${movieId}:${usToday(now)}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const value = (async (): Promise<MovieAnalytics | null> => {
    const { data: rows, error } = await db.from('us_movie_day').select(DAY_COLUMNS).eq('movie_id', movieId).order('report_date');
    if (error) throw new Error(`us_movie_day: ${error.message}`);
    if (!rows || rows.length === 0) return null;
    const safe = cleanSlug(slug);
    const { data: india } = await db.from('bf_movie').select('slug,title,poster').eq('slug', safe).maybeSingle();
    // A Fyre movie with USA data only: title and poster from Fyre's catalog.
    const canon = await catalogMovie(safe);
    const movie = india ? { ...india, poster: india.poster ?? canon?.poster ?? null } : canon ? { slug: safe, title: canon.title, poster: canon.poster } : null;
    const bo = rows.filter((r: any) => r.kind === 'boxoffice');
    // 90-day rule: only the recent part of this movie's USA run was imported
    // -> tracked period, no release-day numbers (unless India knows Day 1).
    const hist = (await catalogHistory().catch(() => new Map())).get(safe);
    const partial = hist?.usa === false;
    const keepDays = !partial || (!!india && hist?.india !== false);
    const dayOneStored = bo.find((r: any) => r.release_day === 1)?.report_date ?? rows.find((r: any) => r.release_day === 1)?.report_date ?? null;
    const dayOne = keepDays ? dayOneStored : null;
    const toPoint = (r: any): DayPoint => ({
      date: r.report_date,
      day: keepDays ? r.release_day : null,
      label: usDayLabel(keepDays ? r.release_day : null, r.report_date, dayOne, formatDate),
      final: !!r.final,
      detail: !r.detail_pruned,
      breakdowns: !r.breakdown_pruned,
      metrics: usMetrics(r),
      sourceUpdated: etStamp(r.source_seen_at ?? r.synced_at),
      provenance: {
        source: 'BFILMY_USA',
        sourceUrl: r.source_url,
        sourceMovieIds: (r.source_movie_ids ?? []).map(Number),
        etag: r.source_etag,
        seenAt: r.source_seen_at,
        syncedAt: r.synced_at,
        showsSource: numOrNull(r.shows_source),
        occupancySource: numOrNull(r.occupancy_source),
        zeroSeatShows: num(r.zero_seat_shows),
        occupancyCoverage: num(r.zero_seat_shows) > 0 ? 'PARTIAL' : 'MATCH',
        recon: r.recon ?? {}
      }
    });
    const days: DayPoint[] = bo.map(toPoint);
    const advance: DayPoint[] = rows.filter((r: any) => r.kind === 'advance').map(toPoint);
    const lifetime = sumMetrics(days.map((d) => d.metrics));
    const complete = days.length > 0 && days.every((d) => d.detail);
    if (complete) {
      const dist = await theaterDistinct(movieId, 'boxoffice', days.map((d) => d.date));
      if (dist) Object.assign(lifetime, { venues: dist.theatres.size, cities: dist.cities.size, states: dist.states.size });
    } else if (days.length === 1) Object.assign(lifetime, { venues: days[0].metrics.venues, cities: days[0].metrics.cities, states: days[0].metrics.states });
    const today = usToday(now);
    const last = bo[bo.length - 1]?.report_date ?? null;
    const updated = rows.map((r: any) => r.source_seen_at ?? r.synced_at).filter(Boolean).sort().map((x: string) => etStamp(x));
    return {
      territory: 'US',
      currency: 'USD',
      movieId,
      slug: safe,
      title: movie?.title ?? safe,
      poster: movie?.poster ?? null,
      languages: [],
      formats: [],
      state: last && last >= usToday(now, -1) ? 'live' : last ? 'final' : advance.some((a) => a.date >= today) ? 'advance' : 'unknown',
      dayOne,
      premiereDate: bo.find((r: any) => r.release_day === 0)?.report_date ?? null,
      carriedOver: partial,
      historyStart: partial ? hist?.usaStart ?? bo[0]?.report_date ?? null : null,
      latestDay: days[days.length - 1] ?? null,
      days,
      advance,
      lifetime: { ...lifetime, days: days.length, complete },
      lastUpdated: updated[updated.length - 1] ?? null
    };
  })();
  memo.set(key, { at: Date.now(), value });
  value.catch(() => memo.delete(key));
  if (memo.size > 300) memo.delete(memo.keys().next().value as string);
  return value;
}

async function breakdownRows(movieId: string, kind: string, dates: string[], dimension: string): Promise<Map<string, unknown[][]>> {
  const out = new Map<string, unknown[][]>();
  for (let i = 0; i < dates.length; i += 30) {
    const { data, error } = await db.from('us_movie_breakdown').select('report_date,rows').eq('movie_id', movieId).eq('kind', kind).eq('dimension', dimension).in('report_date', dates.slice(i, i + 30));
    if (error) throw new Error(`us_movie_breakdown: ${error.message}`);
    for (const r of data ?? []) out.set(r.report_date, r.rows ?? []);
  }
  return out;
}

// Exact distinct theatres / cities / states over several dates, from the
// theater tuples [[theater, city, state, chain], ...] (kept 30 days).
async function theaterDistinct(movieId: string, kind: string, dates: string[]) {
  const by = await breakdownRows(movieId, kind, dates, 'theater');
  if (by.size < dates.length) return null;
  const theatres = new Set<string>();
  const cities = new Set<string>();
  const states = new Set<string>();
  const perState = new Map<string, { t: Set<string>; c: Set<string> }>();
  const perChain = new Map<string, { t: Set<string>; c: Set<string> }>();
  const perCity = new Map<string, { t: Set<string> }>();
  for (const rows of by.values()) {
    for (const t of rows) {
      const [theater, city, state, chain] = (t[0] as string[]).map(String);
      const tid = `${theater}|${city}|${state}`;
      const cid = `${city}|${state}`;
      theatres.add(tid);
      cities.add(cid);
      states.add(state);
      const s = perState.get(state) ?? { t: new Set(), c: new Set() };
      s.t.add(tid);
      s.c.add(cid);
      perState.set(state, s);
      const ch = perChain.get(chain) ?? { t: new Set(), c: new Set() };
      ch.t.add(tid);
      ch.c.add(cid);
      perChain.set(chain, ch);
      const ci = perCity.get(cid) ?? { t: new Set() };
      ci.t.add(tid);
      perCity.set(cid, ci);
    }
  }
  return { theatres, cities, states, perState, perChain, perCity };
}

export async function usSelectionSummary(m: MovieAnalytics, r: Resolved): Promise<Metrics | null> {
  if (r.points.length === 0) return null;
  if (r.points.length === 1) return r.points[0].metrics;
  const sum = sumMetrics(r.points.map((p) => p.metrics));
  if (m.movieId && r.points.every((p) => p.detail)) {
    const dist = await theaterDistinct(m.movieId, r.kind, r.points.map((p) => p.date));
    if (dist) Object.assign(sum, { venues: dist.theatres.size, cities: dist.cities.size, states: dist.states.size });
  }
  return sum;
}

function rowFor(dimension: Dimension, key: string[], metrics: Metrics): BreakdownRow {
  switch (dimension) {
    case 'city':
      return { key: `city:${key[0]}|${key[1]}`, name: key[0], sub: key[1] || null, metrics };
    case 'theater':
      return { key: `theater:${key[0]}|${key[1]}|${key[2]}`, name: key[0], sub: `${key[1]}, ${key[2]}${key[3] && key[3] !== 'Unknown' ? ` · ${key[3]}` : ''}`, metrics };
    case 'format_language':
      return { key: `fl:${key[0]}|${key[1]}`, name: key[1], sub: key[0], metrics };
    default:
      return { key: `${dimension}:${key[0]}`, name: key[0], sub: null, metrics };
  }
}

export async function loadUsaBreakdown(m: MovieAnalytics, sel: Selection, dimension: Dimension): Promise<Breakdown> {
  const r = resolveSelection(m, sel);
  const dates = r.points.map((p) => p.date);
  const base = { dimension, label: DIMENSION_LABELS[dimension], dates, currency: 'USD' as const };
  const no = (reason: string | null): Breakdown => ({ ...base, available: false, reason, source: null, total: 0, rows: [], totalRow: null });
  if (!US_DIMENSION_LIST.includes(dimension)) return no('Not available for the USA feed.');
  if (!m.movieId) return no('No USA data');
  if (r.points.length === 0) return no(r.reason);
  if (US_DETAIL.includes(dimension) && r.points.some((p) => !p.detail)) return no('City and theater breakdowns are kept for the most recent 30 days. Day totals are kept permanently.');
  if (r.points.some((p) => !p.breakdowns)) return no('Breakdowns are kept for the most recent 90 days. Day totals are kept permanently.');

  const by = await breakdownRows(m.movieId, r.kind, dates, dimension);
  if (by.size < dates.length) return no('This breakdown is missing for some dates in the selection.');
  const single = dates.length === 1;
  const acc = new Map<string, { key: string[]; shows: number; seats: number; sold: number; gross: number; zero: number; theatres: number | null; cities: number | null }>();
  for (const rows of by.values()) {
    for (const t of rows) {
      const k = (t[0] as unknown[]).map(String);
      const id = k.join('|');
      const e = acc.get(id) ?? { key: k, shows: 0, seats: 0, sold: 0, gross: 0, zero: 0, theatres: null, cities: null };
      e.shows += num(t[1]);
      e.seats += num(t[2]);
      e.sold += num(t[3]);
      e.gross += num(t[4]);
      e.zero += num(t[5]);
      if (single) {
        e.theatres = numOrNull(t[6]);
        e.cities = numOrNull(t[7]);
      }
      acc.set(id, e);
    }
  }
  // Distinct counts across several dates: only where the theater tuples
  // can give them exactly.
  if (!single && ['state', 'chain', 'city', 'theater'].includes(dimension) && r.points.every((p) => p.detail)) {
    const dist = await theaterDistinct(m.movieId, r.kind, dates);
    if (dist) {
      for (const e of acc.values()) {
        const g = dimension === 'state' ? dist.perState.get(e.key[0]) : dimension === 'chain' ? dist.perChain.get(e.key[0]) : null;
        if (g) {
          e.theatres = g.t.size;
          e.cities = g.c.size;
        }
        if (dimension === 'city') e.theatres = dist.perCity.get(`${e.key[0]}|${e.key[1]}`)?.t.size ?? null;
      }
    }
  }
  const zeroSeat = [...acc.values()].reduce((a, e) => a + e.zero, 0);
  const rows = [...acc.values()]
    .map((e) =>
      rowFor(
        dimension,
        e.key,
        makeMetrics({ gross: e.gross, tickets: e.sold, shows: e.shows, seats: e.seats, venues: dimension === 'theater' ? null : e.theatres, cities: dimension === 'city' || dimension === 'theater' ? null : e.cities })
      )
    )
    .sort((a, b) => b.metrics.gross - a.metrics.gross || b.metrics.tickets - a.metrics.tickets || a.key.localeCompare(b.key));
  const headline = await usSelectionSummary(m, r);
  const totalRow = breakdownTotal(rows, headline, {
    exhaustive: true,
    live: r.points.some((p) => !p.final),
    occupancyCoverage: zeroSeat > 0 ? 'PARTIAL' : 'MATCH',
    money: formatUsd
  });
  return { ...base, available: true, reason: null, source: 'show-level', total: rows.length, rows, totalRow };
}

// USA show-level drilldown (kept 7 days + open advance dates).
export async function loadUsaShows(slug: string, date: string, kind: 'boxoffice' | 'advance' = 'boxoffice'): Promise<ShowList> {
  const base = { date, kind, rows: [] as ShowRow[], currency: 'USD' as const };
  const movieId = await usaMovieId(slug);
  if (!movieId) return { ...base, source: null, available: false, reason: 'Movie not tracked', sourceUpdated: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ...base, source: null, available: false, reason: 'Invalid date', sourceUpdated: null };
  const stored: any[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await db
      .from('us_show')
      .select('show_local,show_time_local,format,language,theater,city,state,chain,sold,seats,price,gross,occupancy_source')
      .eq('movie_id', movieId)
      .eq('kind', kind)
      .eq('report_date', date)
      .order('show_id')
      .range(from, from + 999);
    if (error) throw new Error(`us_show: ${error.message}`);
    stored.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  if (!stored.length) {
    return { ...base, source: null, available: false, reason: 'Show-by-show rows are kept for the last 7 days (and open advance dates) only. Day totals stay permanently.', sourceUpdated: null };
  }
  const { data: file } = await db.from('us_sync_file').select('first_seen_at').eq('kind', kind).eq('report_date', date).maybeSingle();
  const rows: ShowRow[] = stored.map((r: any) => {
    const seats = num(r.seats);
    const sold = num(r.sold);
    const time = String(r.show_time_local ?? '');
    const h = Number(time.slice(0, 2));
    const nextDay = String(r.show_local ?? '').slice(0, 10) > date;
    return {
      venue: String(r.theater ?? '').trim(),
      city: String(r.city ?? '').trim(),
      state: String(r.state ?? '').trim(),
      chain: r.chain ? String(r.chain).trim() : null,
      time: `${time}${nextDay ? ' (+1)' : ''}`,
      hour: Number.isFinite(h) ? h : null,
      format: r.format,
      language: r.language,
      audi: null, // not in the source
      seats,
      available: seats > 0 ? seats - sold : null, // DERIVED
      sold,
      gross: num(r.gross),
      occupancy: seats > 0 ? round2((sold / seats) * 100) : null,
      price: numOrNull(r.price),
      occupancySource: numOrNull(r.occupancy_source)
    };
  });
  rows.sort((a, b) => b.gross - a.gross || b.sold - a.sold || a.venue.localeCompare(b.venue));
  return { ...base, source: 'stored', available: true, reason: null, sourceUpdated: etStamp(file?.first_seen_at), rows };
}

// Advance DoD (DERIVED): each daily capture of one show date minus the
// previous day's capture. Exists only from when Fyre began capturing.
export async function loadUsaAdvanceTrend(slug: string, showDate: string) {
  const movieId = await usaMovieId(slug);
  if (!movieId) return null;
  const { data, error } = await db.from('us_advance_snapshot').select('captured_on,captured_at,gross,tickets,shows,seats,theatres').eq('movie_id', movieId).eq('show_date', showDate).order('captured_on');
  if (error) throw new Error(`us_advance_snapshot: ${error.message}`);
  const snaps = data ?? [];
  return snaps.map((s: any, i: number) => {
    const prev = snaps[i - 1];
    const consecutive = prev && Date.parse(`${s.captured_on}T00:00:00Z`) - Date.parse(`${prev.captured_on}T00:00:00Z`) === 86_400_000;
    return {
      capturedOn: s.captured_on,
      capturedAt: s.captured_at,
      gross: num(s.gross),
      tickets: num(s.tickets),
      shows: num(s.shows),
      dodGross: consecutive ? round2(num(s.gross) - num(prev.gross)) : null,
      dodTickets: consecutive ? num(s.tickets) - num(prev.tickets) : null,
      origin: 'DERIVED' as const
    };
  });
}
