// Helpers shared by the admin matching routes (USA and India listings).
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NO_MATCH_NOTE } from '@/lib/usa/match';

const db = supabaseAdmin as any;

// Stored notes written before the catalog change read neutrally.
export function displayNote(note: string | null): string | null {
  return note === 'Not a MovieMint-tracked movie' ? NO_MATCH_NOTE : note;
}

// Every Fyre movie an admin can match a listing to: title from India data,
// else the canonical title (USA-only movies have no India row).
export async function adminMovieList(): Promise<{ movieId: string; slug: string; title: string; origin: string }[]> {
  const { data: tracked, error } = await db.from('fyre_tracked_movie').select('moviemint_id,bf_slug,title,origin').eq('match_status', 'matched').not('bf_slug', 'is', null);
  if (error) throw new Error(`fyre_tracked_movie: ${error.message}`);
  const slugs = (tracked ?? []).map((t: any) => t.bf_slug);
  const title = new Map<string, string>();
  for (let i = 0; i < slugs.length; i += 200) {
    const { data } = await db.from('bf_movie').select('slug,title').in('slug', slugs.slice(i, i + 200));
    for (const t of data ?? []) title.set(t.slug, t.title);
  }
  return (tracked ?? [])
    .map((t: any) => ({ movieId: t.moviemint_id, slug: t.bf_slug, title: title.get(t.bf_slug) ?? t.title ?? t.bf_slug, origin: t.origin ?? 'moviemint' }))
    .sort((a: any, b: any) => a.title.localeCompare(b.title));
}

// The permanent mapping record (fyre_movie_alias). A listing taken off a
// movie keeps its row, with the decision changed -- so its title stops
// counting as one of the movie's titles, but the history stays.
export async function recordDecision(d: {
  movieId: string;
  source: 'bfilmy_usa' | 'bfilmy_india';
  sourceTitle: string;
  sourceKey?: string | null;
  sourceMovieId: string;
  method: string;
  confidence: string;
  decision: 'matched' | 'unmatched' | 'rejected';
}): Promise<void> {
  if (d.decision !== 'matched') {
    const { error } = await db
      .from('fyre_movie_alias')
      .update({ decision: d.decision, note: `${d.decision} by admin ${new Date().toISOString().slice(0, 10)}` })
      .eq('movie_id', d.movieId)
      .eq('source', d.source)
      .eq('source_movie_id', d.sourceMovieId)
      .in('decision', ['matched', 'created']);
    if (error) throw new Error(`fyre_movie_alias: ${error.message}`);
    return;
  }
  const { error } = await db.from('fyre_movie_alias').insert({
    movie_id: d.movieId,
    source: d.source,
    source_title: d.sourceTitle,
    source_key: d.sourceKey ?? null,
    source_movie_id: d.sourceMovieId,
    match_method: d.method,
    match_confidence: d.confidence,
    decision: 'matched',
    decided_by: 'admin'
  });
  if (error) throw new Error(`fyre_movie_alias: ${error.message}`);
}
