// Which movies Fyre tracks. MovieMint's list decides (lib/moviemint); each
// MovieMint movie is matched to one BFILMY movie (fyre_tracked_movie). Only
// those movies are imported from BFILMY and shown anywhere on Fyre.
import { supabase } from '@/lib/supabaseClient';

type Client = typeof supabase;

// Movies shown on the public site: matched, whether still running on
// MovieMint (active) or not any more (ended/stopped -- history kept).
const PUBLIC_STATUSES = ['active', 'ended', 'stopped'];

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
      .eq('tracking_status', 'active')
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
