import * as cheerio from 'cheerio';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ---------------------------------------------------------------------------
// Same idea as lib/discoverMovies.ts, but for movies that haven't released
// yet: reads Sacnilk's public "Upcoming Movies" listing and adds any we
// don't already have to the `upcoming` table.
//
// A movie found here is dropped from `upcoming` again once it shows up as
// a real release in lib/discoverMovies.ts (see the cleanup at the bottom
// of that file) -- so it "graduates" from Upcoming to Now Showing on its
// own instead of sitting in both.
// ---------------------------------------------------------------------------

const UPCOMING_URL = 'https://www.sacnilk.com/upcoming-movies';

type DiscoveredUpcoming = {
  slug: string;
  title: string;
  releaseDate: string | null; // ISO yyyy-mm-dd
  posterUrl: string | null;
};

function parseUpcoming(html: string): DiscoveredUpcoming[] {
  const $ = cheerio.load(html);
  const bySlug = new Map<string, DiscoveredUpcoming>();

  $('a[href^="/movie/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const slug = href.replace(/^\/movie\//, '').split(/[?#]/)[0];
    if (!slug || bySlug.has(slug)) return;

    const h3 = $(el).find('h3').first();
    const title = (h3.attr('title') || h3.text() || $(el).find('img').attr('alt') || '').trim();
    if (!title) return;

    const posterUrl = $(el).find('img').attr('src') || null;

    // The card doesn't tag its release date with its own class we can rely
    // on staying put, so just look for a "Mon DD, YYYY" pattern anywhere in
    // the card's text instead -- more resilient to markup tweaks.
    const cardText = $(el).text();
    const dateMatch = cardText.match(/([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})/);
    let releaseDate: string | null = null;
    if (dateMatch) {
      const parsed = new Date(`${dateMatch[1]} ${dateMatch[2]}, ${dateMatch[3]} UTC`);
      if (!isNaN(parsed.getTime())) releaseDate = parsed.toISOString().slice(0, 10);
    }

    bySlug.set(slug, { slug, title, releaseDate, posterUrl });
  });

  return Array.from(bySlug.values());
}

export async function discoverUpcoming() {
  const added: string[] = [];
  const errors: { title: string; message: string }[] = [];

  let html: string;
  try {
    const res = await fetch(UPCOMING_URL, {
      headers: {
        'User-Agent':
          'FyreBoxOfficeBot/1.0 (+personal project; reads public upcoming-movies listing only, respects robots.txt, 1 request per sync)'
      },
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err: any) {
    return { added, errors: [{ title: '', message: `upcoming page: ${err?.message ?? String(err)}` }] };
  }

  const movies = parseUpcoming(html);
  if (movies.length === 0) return { added, errors };

  // Skip anything we already have as upcoming, and anything that's already
  // a real release in now_showing (e.g. the upcoming listing hasn't caught
  // up yet).
  const [{ data: existingUpcoming, error: upcomingError }, { data: existingShowing, error: showingError }] = await Promise.all([
    supabaseAdmin.from('upcoming').select('sacnilk_slug').not('sacnilk_slug', 'is', null),
    supabaseAdmin.from('now_showing').select('sacnilk_slug').not('sacnilk_slug', 'is', null)
  ]);
  if (upcomingError || showingError) {
    return { added, errors: [{ title: '', message: (upcomingError ?? showingError)!.message }] };
  }
  const known = new Set([
    ...(existingUpcoming ?? []).map((r) => r.sacnilk_slug as string),
    ...(existingShowing ?? []).map((r) => r.sacnilk_slug as string)
  ]);

  for (const movie of movies) {
    if (known.has(movie.slug)) continue;

    try {
      const row: Record<string, any> = {
        title: movie.title,
        sacnilk_slug: movie.slug,
        release_date: movie.releaseDate,
        image_url: movie.posterUrl
      };
      const { error: insertError } = await supabaseAdmin.from('upcoming').insert(row);
      if (insertError) throw new Error(insertError.message);

      added.push(movie.title);
    } catch (err: any) {
      errors.push({ title: movie.title, message: err?.message ?? String(err) });
    }
  }

  return { added, errors };
}
