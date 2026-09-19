import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseMovieProfile } from '@/lib/sacnilkMovieProfileParser';

// Pulls each movie's Sacnilk profile page (https://www.sacnilk.com/movie/<slug>)
// -- synopsis, Key Details, Release Information, the Total Collections
// Summary cards, and a per-language Net Collection + Verdict card for
// movies Sacnilk tracks by version -- into now_showing and movie_versions.
// See lib/sacnilkMovieProfileParser.ts for exactly what's read.
//
// Only movies with a `sacnilk_slug` (set automatically by discoverMovies(),
// see supabase/migration_discovery.sql) have a profile page to read --
// movies added by hand without one are skipped rather than guessed at.
export async function syncMovieProfiles(movieId?: string) {
  let query = supabaseAdmin.from('now_showing').select('id, title, sacnilk_slug').not('sacnilk_slug', 'is', null);
  if (movieId) query = query.eq('id', movieId);
  const { data: movies, error: moviesError } = await query;

  if (moviesError) {
    return { synced: [] as string[], errors: [{ title: '', message: moviesError.message }] };
  }
  if (!movies || movies.length === 0) {
    return { synced: [] as string[], errors: [] as { title: string; message: string }[] };
  }

  const synced: string[] = [];
  const errors: { title: string; message: string }[] = [];

  for (const movie of movies) {
    try {
      // One request per movie, paced the same as syncBoxOffice.ts --
      // Sacnilk's robots.txt sets Crawl-delay: 1, so this never goes
      // faster than that.
      const url = `https://www.sacnilk.com/movie/${movie.sacnilk_slug}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'FyreBoxOfficeBot/1.0 (+personal project; reads public movie profile pages only, respects robots.txt, 1 request per movie per sync)'
        },
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const profile = parseMovieProfile(html);

      const update: Record<string, any> = { profile_synced_at: new Date().toISOString() };
      if (profile.description) update.description = profile.description;
      if (profile.genre) update.genre = profile.genre;
      if (profile.runtime) update.runtime = profile.runtime;
      if (profile.cbfcRating) update.cbfc_rating = profile.cbfcRating;
      if (profile.languages) update.profile_languages = profile.languages;
      if (profile.theatricalReleaseDate) update.release_date = profile.theatricalReleaseDate;
      if (profile.ottReleaseStatus) update.ott_release_status = profile.ottReleaseStatus;
      if (profile.totals.indiaGrossCr != null) update.total_india_gross = `₹${profile.totals.indiaGrossCr.toFixed(2)} Cr`;
      if (profile.totals.worldwideCr != null) update.total_worldwide = `₹${profile.totals.worldwideCr.toFixed(2)} Cr`;
      if (profile.totals.overseasCr != null) update.total_overseas = `₹${profile.totals.overseasCr.toFixed(2)} Cr`;
      if (profile.totals.indiaNetCr != null) update.total_india_net = `₹${profile.totals.indiaNetCr.toFixed(2)} Cr`;
      if (profile.totals.indiaSharePct != null) update.india_share_pct = profile.totals.indiaSharePct;
      if (profile.totals.overseasSharePct != null) update.overseas_share_pct = profile.totals.overseasSharePct;
      if (profile.totals.verdict) update.box_office_verdict = profile.totals.verdict;

      const { error: updateError } = await supabaseAdmin.from('now_showing').update(update).eq('id', movie.id);
      if (updateError) throw new Error(`now_showing update: ${updateError.message}`);

      if (profile.versions.length > 0) {
        const rows = profile.versions.map((v) => ({
          movie_id: movie.id,
          language: v.language,
          net_collection: v.netCollectionText,
          verdict: v.verdict,
          synced_at: new Date().toISOString()
        }));
        const { error: versionsError } = await supabaseAdmin
          .from('movie_versions')
          .upsert(rows, { onConflict: 'movie_id,language' });
        if (versionsError) throw new Error(`movie_versions upsert: ${versionsError.message}`);
      }

      synced.push(movie.title);
    } catch (err: any) {
      errors.push({ title: movie.title, message: err?.message ?? String(err) });
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  return { synced, errors };
}
