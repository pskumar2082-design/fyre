// India spelling variants an admin confirmed (fyre_movie_alias, source
// bfilmy_india) merged into the alias map the BFILMY India import groups
// titles by -- so "Bethlehem Kudumba Unit" is added into "Bethlehem
// Kutumba Unit" BEFORE a day's figures are aggregated (two listings of one
// movie on one date are summed, never written over each other).
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { buildAliasMap, FYRE_ALIASES, titleKey, baseTitle } from '@/lib/bfilmy/normalize';
import type { BfAliasFile } from '@/lib/bfilmy/types';

const db = supabaseAdmin as any;

// canonical India title -> confirmed variant titles.
export async function confirmedIndiaAliases(): Promise<BfAliasFile> {
  const { data: rows, error } = await db
    .from('fyre_movie_alias')
    .select('movie_id,source_title,source_movie_id')
    .eq('source', 'bfilmy_india')
    .eq('decision', 'matched');
  if (error) {
    // Table not created yet (migration_catalog.sql not run): no extra aliases.
    if (/fyre_movie_alias/.test(error.message)) return {};
    throw new Error(`fyre_movie_alias: ${error.message}`);
  }
  if (!rows?.length) return {};
  const ids = [...new Set(rows.map((r: any) => r.movie_id))];
  const { data: movies } = await db.from('fyre_tracked_movie').select('moviemint_id,bf_slug').in('moviemint_id', ids);
  const slugOf = new Map((movies ?? []).map((m: any) => [m.moviemint_id, m.bf_slug]));
  const slugs = [...new Set([...slugOf.values()].filter(Boolean))];
  const { data: keys } = slugs.length ? await db.from('bf_title_key').select('key,slug,title,created_at').in('slug', slugs).order('created_at') : { data: [] };
  // The movie's first real India key is the one its data is stored under.
  const primary = new Map<string, { key: string; title: string }>();
  for (const k of keys ?? []) if (!String(k.key).startsWith('fyre:') && !primary.has(k.slug)) primary.set(k.slug, { key: k.key, title: k.title });
  const out: BfAliasFile = {};
  for (const r of rows) {
    const p = primary.get(slugOf.get(r.movie_id) as string);
    if (!p || r.source_movie_id === p.key) continue;
    if (titleKey(baseTitle(p.title)) !== p.key) continue; // only when the title reproduces the stored key
    (out[p.title] ??= []).push(r.source_title);
  }
  return out;
}

export async function fyreAliasMap(fetched: BfAliasFile | null | undefined): Promise<Map<string, string>> {
  const confirmed = await confirmedIndiaAliases().catch(() => ({}) as BfAliasFile);
  const extra: BfAliasFile = { ...FYRE_ALIASES };
  for (const [canon, variants] of Object.entries(confirmed)) extra[canon] = [...(extra[canon] ?? []), ...variants];
  return buildAliasMap(fetched, extra);
}
