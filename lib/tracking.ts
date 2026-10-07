// Which movies Fyre tracks: Fyre's own catalog (fyre_tracked_movie), built
// from BFILMY India / USA discovery (lib/catalog). MovieMint is never needed.
// Only catalog movies are imported from BFILMY and shown anywhere on Fyre.
import { supabase } from '@/lib/supabaseClient';

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
