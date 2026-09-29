// What fyre's pages and API routes call for box-office data. Reads only
// from Supabase (filled by the BFILMY sync job, lib/bfilmy/sync.ts) --
// never from BFILMY directly -- and returns the same shapes the
// TrackTollywood scraper did (see ./adapter.ts), with the same function
// names, so switching a page over is a one-line import change.
import { supabase } from '@/lib/supabaseClient';
import type { TTListedMovie, TTMovieDetails } from '@/lib/tracktollywood/types';
import {
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

export async function getMovieDetails(slug: string): Promise<TTMovieDetails | null> {
  const safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!safeSlug) return null;
  const today = todayIST();
  return remember(`movie:${safeSlug}:${today}`, 60_000, async () => {
    const { data: row, error } = await supabase.from('bf_movie').select(MOVIE_COLUMNS).eq('slug', safeSlug).maybeSingle();
    if (error) throw new Error(`bf_movie: ${error.message}`);
    if (!row) return null;

    const [daysRes, cumRes] = await Promise.all([
      supabase.rpc('bf_movie_days', { p_slug: safeSlug, p_city_limit: 50, p_chain_limit: 30 }),
      (row as BfMovieRow).first_date
        ? supabase.rpc('bf_movie_cumulative', { p_slug: safeSlug, p_city_limit: 100, p_chain_limit: 50 })
        : Promise.resolve({ data: null, error: null })
    ]);
    if (daysRes.error) throw new Error(`bf_movie_days: ${daysRes.error.message}`);
    if (cumRes.error) throw new Error(`bf_movie_cumulative: ${cumRes.error.message}`);

    return detailsFromData(row as BfMovieRow, (daysRes.data ?? []) as BfStoredDay[], (cumRes.data ?? null) as BfCumulative | null, today);
  });
}

// When the sync job last ran, and what it saw -- for an "Updated" note.
export async function getLastSync(): Promise<{ finishedAt: string; errors: string[] } | null> {
  const { data, error } = await supabase.from('bf_sync_state').select('value').eq('key', 'last_sync').maybeSingle();
  if (error || !data) return null;
  const v = (data as { value: any }).value;
  return v ? { finishedAt: String(v.finishedAt ?? ''), errors: Array.isArray(v.errors) ? v.errors : [] } : null;
}
