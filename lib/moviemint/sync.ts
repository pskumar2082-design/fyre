// MovieMint list refresh -- ENRICHMENT ONLY (legacy).
//
// Fyre's catalog is built from BFILMY discovery (lib/catalog). MovieMint is
// no longer a gatekeeper: this job only refreshes the stored copy of
// MovieMint's list (mm_movie: title, language, release date, poster) that
// catalog metadata may borrow from. It never creates, matches, activates or
// ends a Fyre movie, and it is allowed to fail: if MovieMint is unreachable
// nothing else in the sync is affected.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { chunks } from '@/lib/bfilmy/sync';
import { fetchTrackedList } from './catalog';

export type CatalogSyncResult = {
  fetchedAt: string;
  movies: number;
  offList: number;
  errors: string[];
};

export async function syncMovieMintCatalog(opts: { timeoutMs?: number } = {}): Promise<CatalogSyncResult> {
  const errors: string[] = [];
  const { movies, fetchedAt } = await fetchTrackedList(opts.timeoutMs);
  const now = new Date().toISOString();
  const mmRows = movies.map((m) => ({
    moviemint_id: m.id,
    title: m.title,
    language: m.language,
    release_date: m.releaseDate,
    poster: m.poster,
    badge: m.badge,
    source_url: m.sourceUrl,
    last_tracked_date: m.lastTrackedDate,
    on_list: true,
    last_seen: now,
    updated_at: now
  }));
  for (const batch of chunks(mmRows, 200)) {
    const { error } = await supabaseAdmin.from('mm_movie').upsert(batch, { onConflict: 'moviemint_id' });
    if (error) throw new Error(`mm_movie upsert: ${error.message}`);
  }
  // Off MovieMint's list: recorded on mm_movie only. Fyre tracking is not
  // touched.
  const onList = new Set(movies.map((m) => m.id));
  const { data: allMm } = await supabaseAdmin.from('mm_movie').select('moviemint_id,on_list');
  const gone = (allMm ?? []).filter((r: any) => r.on_list && !onList.has(r.moviemint_id)).map((r: any) => r.moviemint_id);
  for (const batch of chunks(gone, 200)) {
    const { error } = await supabaseAdmin.from('mm_movie').update({ on_list: false, updated_at: now }).in('moviemint_id', batch);
    if (error) errors.push(`mm_movie off-list: ${error.message}`);
  }
  const result: CatalogSyncResult = { fetchedAt, movies: movies.length, offList: gone.length, errors };
  await supabaseAdmin.from('bf_sync_state').upsert({ key: 'last_moviemint_sync', value: result, updated_at: now }, { onConflict: 'key' });
  return result;
}
