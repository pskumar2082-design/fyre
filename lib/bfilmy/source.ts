// What fyre's pages and API routes call for box-office data. Reads only
// from Supabase (filled by the BFILMY sync job, lib/bfilmy/sync.ts) --
// never from BFILMY directly -- and returns the same shapes the
// TrackTollywood scraper did (see ./adapter.ts), with the same function
// names, so switching a page over is a one-line import change.
import { supabase } from '@/lib/supabaseClient';
import type { TTListedMovie, TTMovieDetails, TTTable } from '@/lib/boxoffice/types';
import {
  dayBreakdownTables,
  dayHeading,
  detailsFromData,
  listedFromRow,
  parseAmountToCr,
  parseReleaseDate,
  type BfCumulative,
  type BfMovieRow,
  type BfStoredDay
} from './adapter';

export { parseAmountToCr, parseReleaseDate };

const MOVIE_COLUMNS =
  'slug,title,languages,formats,poster,release_date,premiere_date,carried_over,first_date,last_date,days_tracked,total_gross,total_sold,total_shows,total_seats,latest,best,advance,advance_date,source_updated';

export function todayIST(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

// Tiny per-process memo so one page render that asks for the same data
// several times (e.g. the homepage's upcoming row) hits the database once.
// Short on purpose: the data itself only changes every 30 minutes.
const memo = new Map<string, { at: number; value: Promise<unknown> }>();
function remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  memo.set(key, { at: Date.now(), value });
  value.catch(() => memo.delete(key));
  return value;
}

async function selectMovies(apply: (q: any) => any): Promise<BfMovieRow[]> {
  const out: BfMovieRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await apply(supabase.from('bf_movie').select(MOVIE_COLUMNS)).range(from, from + 999);
    if (error) throw new Error(`bf_movie: ${error.message}`);
    out.push(...((data ?? []) as BfMovieRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// Movies in theatres now (box office today or yesterday) plus movies with
// advance bookings open that haven't released yet -- the same set the
// TrackTollywood hub listing used to return.
export async function getLiveMovies(): Promise<TTListedMovie[]> {
  const today = todayIST();
  return remember(`live:${today}`, 60_000, async () => {
    const rows = await selectMovies((q) => q.or(`last_date.gte.${addDays(today, -1)},advance_date.gte.${today}`));
    const latestGross = new Map(rows.map((r) => [r.slug, Number(r.latest?.gross) || 0]));
    const listed = rows.map((r) => listedFromRow(r, today)).filter((m) => m.state === 'live' || m.state === 'advance');
    // In theatres: what's drawing audiences now (latest day's gross), not
    // lifetime gross -- otherwise a film in its tenth week with a handful
    // of shows outranks this week's release.
    const live = listed
      .filter((m) => m.state === 'live')
      .sort((a, b) => (latestGross.get(b.slug) ?? 0) - (latestGross.get(a.slug) ?? 0) || (b.grossCr ?? 0) - (a.grossCr ?? 0));
    // Soonest release first; within a date, biggest advance first (the
    // homepage re-sorts by date only, and JS sort is stable).
    const advance = listed
      .filter((m) => m.state === 'advance')
      .sort(
        (a, b) =>
          (parseReleaseDate(a.releaseText)?.getTime() ?? 0) - (parseReleaseDate(b.releaseText)?.getTime() ?? 0) ||
          (b.grossCr ?? 0) - (a.grossCr ?? 0)
      );
    return [...live, ...advance];
  });
}

// Every movie whose run has finished (no box office since before
// yesterday), highest gross first.
export async function getCompletedMovies(): Promise<TTListedMovie[]> {
  const today = todayIST();
  return remember(`completed:${today}`, 5 * 60_000, async () => {
    const rows = await selectMovies((q) => q.lt('last_date', addDays(today, -1)).gt('total_gross', 0).order('total_gross', { ascending: false }));
    return rows.map((r) => listedFromRow(r, today));
  });
}

// Same list lengths bf_movie_days trims to.
const CITY_LIMIT = 50;
const CHAIN_LIMIT = 30;

// How many of the most recent tracked days the movie page sends with
// their full breakdown tables; older days load when someone opens them.
const PAGE_RECENT_DAYS = 3;

function cleanSlug(slug: string): string {
  return String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function trimBreakdown(b: any): BfStoredDay['breakdown'] {
  if (!b || typeof b !== 'object') return {};
  return {
    states: b.states ?? [],
    formats: b.formats ?? [],
    languages: b.languages ?? [],
    cities: Array.isArray(b.cities) ? b.cities.slice(0, CITY_LIMIT) : [],
    chains: Array.isArray(b.chains) ? b.chains.slice(0, CHAIN_LIMIT) : []
  };
}

async function loadMovieRow(slug: string): Promise<BfMovieRow | null> {
  const { data: row, error } = await supabase.from('bf_movie').select(MOVIE_COLUMNS).eq('slug', slug).maybeSingle();
  if (error) throw new Error(`bf_movie: ${error.message}`);
  return (row as BfMovieRow | null) ?? null;
}

// Every day's totals (no breakdowns), plus full breakdowns for all
// advance dates and the most recent PAGE_RECENT_DAYS tracked days. The
// remaining days come back with breakdown = null, which the adapter
// turns into lazyDays.
async function loadPageDays(slug: string, row: BfMovieRow): Promise<BfStoredDay[]> {
  const days: BfStoredDay[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('bf_movie_day')
      .select('kind,date,totals,source_updated')
      .eq('slug', slug)
      .order('date', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`bf_movie_day: ${error.message}`);
    for (const d of data ?? []) days.push({ ...(d as any), breakdown: null });
    if (!data || data.length < 1000) break;
  }

  const recent = days
    .filter((d) => d.kind === 'boxoffice' && dayHeading(row, d.date))
    .slice(-PAGE_RECENT_DAYS)
    .map((d) => d.date);
  const hasAdvance = days.some((d) => d.kind === 'advance');

  const [recentRes, advanceRes] = await Promise.all([
    recent.length
      ? supabase.from('bf_movie_day').select('kind,date,breakdown').eq('slug', slug).eq('kind', 'boxoffice').in('date', recent)
      : Promise.resolve({ data: [], error: null }),
    hasAdvance
      ? supabase.from('bf_movie_day').select('kind,date,breakdown').eq('slug', slug).eq('kind', 'advance')
      : Promise.resolve({ data: [], error: null })
  ]);
  if (recentRes.error) throw new Error(`bf_movie_day: ${recentRes.error.message}`);
  if (advanceRes.error) throw new Error(`bf_movie_day: ${advanceRes.error.message}`);

  const loaded = new Map<string, BfStoredDay['breakdown']>();
  for (const d of [...(recentRes.data ?? []), ...(advanceRes.data ?? [])] as any[]) {
    loaded.set(`${d.kind}:${d.date}`, trimBreakdown(d.breakdown));
  }
  for (const d of days) {
    const b = loaded.get(`${d.kind}:${d.date}`);
    if (b) d.breakdown = b;
  }
  return days;
}

// detail:
//   'full'    -- every day's breakdown tables (API route: compare, poster tool)
//   'page'    -- the movie page: recent days in full, older days listed in
//                lazyDays and fetched on demand (getMovieDay)
//   'summary' -- headline, stats and meta only, no tables (homepage cards)
export type MovieDetailLevel = 'full' | 'page' | 'summary';

export async function getMovieDetails(slug: string, detail: MovieDetailLevel = 'full'): Promise<TTMovieDetails | null> {
  const safeSlug = cleanSlug(slug);
  if (!safeSlug) return null;
  const today = todayIST();
  return remember(`movie:${detail}:${safeSlug}:${today}`, 60_000, async () => {
    const row = await loadMovieRow(safeSlug);
    if (!row) return null;
    if (detail === 'summary') return detailsFromData(row, [], null, today);

    const [days, cumRes] = await Promise.all([
      detail === 'page'
        ? loadPageDays(safeSlug, row)
        : supabase.rpc('bf_movie_days', { p_slug: safeSlug, p_city_limit: CITY_LIMIT, p_chain_limit: CHAIN_LIMIT }).then((r) => {
            if (r.error) throw new Error(`bf_movie_days: ${r.error.message}`);
            return (r.data ?? []) as BfStoredDay[];
          }),
      row.first_date
        ? supabase.rpc('bf_movie_cumulative', { p_slug: safeSlug, p_city_limit: 100, p_chain_limit: 50 })
        : Promise.resolve({ data: null, error: null })
    ]);
    if (cumRes.error) throw new Error(`bf_movie_cumulative: ${cumRes.error.message}`);

    return detailsFromData(row, days, (cumRes.data ?? null) as BfCumulative | null, today);
  });
}

// One tracked day's breakdown tables, for the movie page's on-demand
// loading of older days. Null when the movie or day doesn't exist or the
// day has no Day number.
export async function getMovieDay(slug: string, date: string): Promise<{ heading: string; date: string; tables: TTTable[] } | null> {
  const safeSlug = cleanSlug(slug);
  if (!safeSlug || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return remember(`day:${safeSlug}:${date}`, 5 * 60_000, async () => {
    const row = await loadMovieRow(safeSlug);
    if (!row) return null;
    const heading = dayHeading(row, date);
    if (!heading) return null;
    const { data, error } = await supabase
      .from('bf_movie_day')
      .select('kind,date,totals,breakdown')
      .eq('slug', safeSlug)
      .eq('kind', 'boxoffice')
      .eq('date', date)
      .maybeSingle();
    if (error) throw new Error(`bf_movie_day: ${error.message}`);
    if (!data) return null;
    const day = { ...(data as any), breakdown: trimBreakdown((data as any).breakdown) } as BfStoredDay;
    return { heading, date, tables: dayBreakdownTables(row, day) };
  });
}

// When the sync job last ran, and what it saw -- for an "Updated" note.
export async function getLastSync(): Promise<{ finishedAt: string; errors: string[] } | null> {
  const { data, error } = await supabase.from('bf_sync_state').select('value').eq('key', 'last_sync').maybeSingle();
  if (error || !data) return null;
  const v = (data as { value: any }).value;
  return v ? { finishedAt: String(v.finishedAt ?? ''), errors: Array.isArray(v.errors) ? v.errors : [] } : null;
}
