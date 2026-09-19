import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseSacnilkArticle, formatIndianShort } from '@/lib/sacnilkParser';

// The actual sync logic, shared by both routes that can trigger it:
//   - app/api/sync-boxoffice/route.ts    (Vercel Cron, CRON_SECRET)
//   - app/api/admin-sync-boxoffice/route.ts (admin panel "Sync now" button,
//     checks the caller is signed in as the admin instead)
// Kept in one place so there's exactly one version of "how we read a
// Sacnilk article and write it into Supabase" to maintain.
export async function syncBoxOffice(movieId?: string) {
  let query = supabaseAdmin.from('now_showing').select('id, title, source_url').not('source_url', 'is', null);
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
      // One request per movie, with a pause between requests — Sacnilk's
      // robots.txt sets Crawl-delay: 1, so we never go faster than that.
      const res = await fetch(movie.source_url as string, {
        headers: {
          'User-Agent':
            'FyreBoxOfficeBot/1.0 (+personal project; reads public day-wise box office articles only, respects robots.txt, 1 request per movie per sync)'
        },
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parsed = parseSacnilkArticle(html);

      if (parsed.days.length > 0) {
        const rows = parsed.days.map((d) => ({
          movie_id: movie.id,
          day_number: d.dayNumber,
          day_date: d.dayDate,
          day_label: d.dayLabel,
          gross: d.gross,
          net: d.net,
          shows: d.shows,
          occ_pct: d.occPct,
          source: 'sacnilk'
        }));
        const { error: upsertError } = await supabaseAdmin
          .from('daily_collections')
          .upsert(rows, { onConflict: 'movie_id,day_number' });
        if (upsertError) throw new Error(`daily_collections upsert: ${upsertError.message}`);
      }

      const latestDay = parsed.days[parsed.days.length - 1];
      const lifetimeGrossCr = parsed.totals.indiaGross ?? parsed.totals.worldwideGross;

      const update: Record<string, any> = { source_synced_at: new Date().toISOString() };
      if (lifetimeGrossCr != null) {
        update.lifetime_gross = `₹${lifetimeGrossCr.toFixed(2)} Cr`;
        update.amt = `₹${lifetimeGrossCr.toFixed(2)} Cr`;
      }
      if (parsed.totals.totalShows != null) {
        update.lifetime_shows = formatIndianShort(parsed.totals.totalShows);
      }
      if (latestDay?.occPct != null) {
        update.lifetime_occupancy = latestDay.occPct;
      }

      const { error: updateError } = await supabaseAdmin.from('now_showing').update(update).eq('id', movie.id);
      if (updateError) throw new Error(`now_showing update: ${updateError.message}`);

      synced.push(movie.title);
    } catch (err: any) {
      errors.push({ title: movie.title, message: err?.message ?? String(err) });
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  return { synced, errors };
}
