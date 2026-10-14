// Which movies Fyre tracks: Fyre's own catalog (fyre_tracked_movie), built
// from BFILMY India / USA discovery (lib/catalog). MovieMint is never needed.
// Only catalog movies are imported from BFILMY and shown anywhere on Fyre.
import { supabase } from '@/lib/supabaseClient';
import { moviemintIndia } from '@/lib/sourcePolicy';

type Client = typeof supabase;

// Movies shown on the public site: matched and not hidden (active, or
// ended/stopped by an admin -- history kept).
const PUBLIC_STATUSES = ['active', 'ended', 'stopped'];
// Imported by the scheduled sync: everything not stopped by an admin.
export const TRACKED_STATUSES = ['active', 'ended'];

let publicMemo: { at: number; value: Promise<Set<string>> } | null = null;

export function publicTrackedSlugs(): Promise<Set<string>> {
  if (publicMemo && Date.now() - publicMemo.at < 5 * 60_000) return publicMemo.value;
  const value = (async () => {
    // MovieMint India policy: the public catalog is MovieMint's (every
    // MovieMint movie linked to its Fyre movie; lib/moviemint/india).
    if (moviemintIndia()) {
      const out = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase as any).from('mmi_catalog').select('slug').eq('link_status', 'linked').not('slug', 'is', null).range(from, from + 999);
        if (error) throw new Error(`mmi_catalog: ${error.message}`);
        for (const r of data ?? []) out.add(r.slug as string);
        if (!data || data.length < 1000) break;
      }
      return out;
    }
    const { data, error } = await supabase
      .from('fyre_tracked_movie')
      .select('bf_slug')
      .eq('match_status', 'matched')
      .in('tracking_status', PUBLIC_STATUSES)
      .not('bf_slug', 'is', null);
    if (error) throw new Error(`fyre_tracked_movie: ${error.message}`);
    return new Set((data ?? []).map((r: any) => r.bf_slug as string));
  })();
  publicMemo = { at: Date.now(), value };
  value.catch(() => (publicMemo = null));
  return value;
}

export async function isPublicMovie(slug: string): Promise<boolean> {
  return (await publicTrackedSlugs()).has(slug);
}

// For the importer: the BFILMY title keys of every movie being synced
// (matched and active), or of the given slugs only.
export async function trackedKeys(client: Client, onlySlugs?: string[]): Promise<{ slugs: Set<string>; keys: Set<string> }> {
  let slugs: string[];
  if (onlySlugs) slugs = onlySlugs;
  else {
    const { data, error } = await client
      .from('fyre_tracked_movie')
      .select('bf_slug')
      .eq('match_status', 'matched')
      // 'ended' was MovieMint's "left its list" -- it no longer stops
      // tracking (only an admin 'stopped' does); BFILMY activity decides.
      .in('tracking_status', TRACKED_STATUSES)
      .not('bf_slug', 'is', null);
    if (error) throw new Error(`fyre_tracked_movie: ${error.message}`);
    slugs = (data ?? []).map((r: any) => r.bf_slug);
  }
  const keys = new Set<string>();
  for (let i = 0; i < slugs.length; i += 200) {
    const { data, error } = await client.from('bf_title_key').select('key').in('slug', slugs.slice(i, i + 200));
    if (error) throw new Error(`bf_title_key: ${error.message}`);
    for (const r of data ?? []) keys.add((r as any).key);
  }
  return { slugs: new Set(slugs), keys };
}

// History completeness per public slug (90-day rule, lib/catalog/core).
// `india` / `usa` = false when Fyre imported only the recent part of a
// long-running movie: its totals are a tracked period, never "lifetime", and
// its release-day numbers are unknown. Missing columns (before
// migration_catalog.sql) = nothing known = treated as complete.
export type CatalogHistory = { india: boolean | null; indiaStart: string | null; usa: boolean | null; usaStart: string | null };
let historyMemo: { at: number; value: Promise<Map<string, CatalogHistory>> } | null = null;

export function catalogHistory(): Promise<Map<string, CatalogHistory>> {
  if (historyMemo && Date.now() - historyMemo.at < 5 * 60_000) return historyMemo.value;
  const value = (async () => {
    const out = new Map<string, CatalogHistory>();
    if (moviemintIndia()) return policyHistory(out);
    const { data, error } = await (supabase as any)
      .from('fyre_tracked_movie')
      .select('bf_slug,history_complete,history_start_date,us_history_complete,us_history_start_date')
      .eq('match_status', 'matched')
      .not('bf_slug', 'is', null)
      .or('history_complete.eq.false,us_history_complete.eq.false');
    if (error) return out;
    for (const r of data ?? [])
      out.set(r.bf_slug, { india: r.history_complete, indiaStart: r.history_start_date, usa: r.us_history_complete, usaStart: r.us_history_start_date });
    return out;
  })();
  historyMemo = { at: Date.now(), value };
  value.catch(() => (historyMemo = null));
  return value;
}

// MovieMint India policy: India history is MovieMint's whole run unless
// MovieMint began tracking after the release (mmi_movie.carried_over); USA
// completeness as recorded on the Fyre movie.
async function policyHistory(out: Map<string, CatalogHistory>): Promise<Map<string, CatalogHistory>> {
  const db = supabase as any;
  const [{ data: links }, { data: india }] = await Promise.all([
    db.from('mmi_catalog').select('slug,movie_id').eq('link_status', 'linked'),
    db.from('mmi_movie').select('slug,first_date').eq('carried_over', true)
  ]);
  const ids = (links ?? []).map((l: any) => l.movie_id).filter(Boolean);
  const usa = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from('fyre_tracked_movie').select('moviemint_id,us_history_complete,us_history_start_date').in('moviemint_id', ids.slice(i, i + 200)).eq('us_history_complete', false);
    for (const r of data ?? []) usa.set(r.moviemint_id, r);
  }
  const carried = new Map((india ?? []).map((r: any) => [r.slug, r.first_date]));
  for (const l of links ?? []) {
    const u = usa.get(l.movie_id);
    if (!carried.has(l.slug) && !u) continue;
    out.set(l.slug, {
      india: carried.has(l.slug) ? false : null,
      indiaStart: (carried.get(l.slug) as string | undefined) ?? null,
      usa: u ? false : null,
      usaStart: u?.us_history_start_date ?? null
    });
  }
  return out;
}

// Marks bf_movie rows whose India history is only the recent part:
// carried_over (no Day numbers, "tracked since" labels) + history_start.
export async function applyCatalogHistory<T extends { slug: string; carried_over?: boolean | null; first_date: string | null; history_start?: string | null }>(rows: T[]): Promise<T[]> {
  const h = await catalogHistory().catch(() => new Map<string, CatalogHistory>());
  for (const r of rows) {
    const x = h.get(r.slug);
    if (x?.india === false) {
      r.carried_over = true;
      r.history_start = x.indiaStart ?? r.first_date;
    }
  }
  return rows;
}
