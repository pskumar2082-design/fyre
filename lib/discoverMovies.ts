import * as cheerio from 'cheerio';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ---------------------------------------------------------------------------
// Finds new movies automatically from Sacnilk's public "India Box Office
// Collection" listing page (all languages) and adds them to `now_showing`
// so they don't have to be entered by hand in admin first.
//
// This reads only the page's own server-rendered HTML — the same one-page,
// one-request approach as lib/syncBoxOffice.ts — and never touches the
// "Load More" pagination, which calls an internal API path Sacnilk's own
// robots.txt says not to crawl (Disallow: /api/). So this only ever sees
// the newest ~20 movies the listing shows by default, which is exactly
// what we want: it's a "what's new" check, not a full historical import.
//
// Each movie's `source_url` (its day-wise collection article) is derived
// from its slug rather than looked up separately, since Sacnilk publishes
// that article at a predictable URL. A brand new (day 1) release won't
// have that article yet — the fetch 404s until Sacnilk publishes it, and
// the existing /api/sync-boxoffice sync just quietly retries on the next
// scheduled run, same as it already does for any temporarily-missing page.
// ---------------------------------------------------------------------------

const LISTING_URL = 'https://www.sacnilk.com/entertainmenttopbar/Box_Office_Collection?hl=en';

// Sacnilk shows each movie's language as its "-wood" industry nickname
// (e.g. "Tollywood"). Anything not in this list (a handful of smaller
// regional industries don't have one) is used as-is — it's usually already
// a plain language name in that case (e.g. "(Odia)").
const INDUSTRY_TO_LANGUAGE: Record<string, string> = {
  Bollywood: 'Hindi',
  Tollywood: 'Telugu',
  Kollywood: 'Tamil',
  Sandalwood: 'Kannada',
  Mollywood: 'Malayalam',
  Pollywood: 'Punjabi',
  Gollywood: 'Gujarati',
  Hollywood: 'English'
};

type DiscoveredMovie = {
  slug: string;
  title: string;
  language: string;
  posterUrl: string | null;
  netCr: number | null;
};

function parseListing(html: string): DiscoveredMovie[] {
  const $ = cheerio.load(html);
  const bySlug = new Map<string, DiscoveredMovie>();

  $('a[href^="/movie/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const slug = href.replace(/^\/movie\//, '').split(/[?#]/)[0];
    if (!slug || bySlug.has(slug)) return;

    const h3 = $(el).find('h3').first();
    const rawTitle = h3.text().trim();
    if (!rawTitle || rawTitle === 'Details') return; // the paired "Details" link, not the title one

    const match = rawTitle.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const title = (match ? match[1] : rawTitle).trim();
    const industry = match ? match[2].trim() : '';
    const language = INDUSTRY_TO_LANGUAGE[industry] ?? industry;

    const posterUrl = $(el).find('img').attr('src') || $(el).closest('div').find('img').attr('src') || null;

    // Best-effort initial "Net" figure from the listing card, e.g. "₹2.50Cr"
    // — just so the card isn't empty until the first real sync fills it in.
    const card = $(el).closest('.flex.items-center.space-x-4').length
      ? $(el).closest('.flex.items-center.space-x-4')
      : $(el).parent().parent();
    const netText = card.find('*:contains("Net:")').last().text();
    const netMatch = netText.match(/Net:\s*₹?\s*([\d.]+)\s*Cr/i);
    const netCr = netMatch ? parseFloat(netMatch[1]) : null;

    bySlug.set(slug, { slug, title, language, posterUrl, netCr });
  });

  return Array.from(bySlug.values());
}

export async function discoverMovies() {
  const added: string[] = [];
  const errors: { title: string; message: string }[] = [];

  let html: string;
  try {
    const res = await fetch(LISTING_URL, {
      headers: {
        'User-Agent':
          'FyreBoxOfficeBot/1.0 (+personal project; reads public box-office listing only, respects robots.txt, 1 request per sync)'
      },
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err: any) {
    return { added, errors: [{ title: '', message: `listing page: ${err?.message ?? String(err)}` }] };
  }

  const movies = parseListing(html);
  if (movies.length === 0) return { added, errors };

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('now_showing')
    .select('sacnilk_slug')
    .not('sacnilk_slug', 'is', null);
  if (existingError) {
    return { added, errors: [{ title: '', message: existingError.message }] };
  }
  const known = new Set((existing ?? []).map((r) => r.sacnilk_slug as string));

  for (const movie of movies) {
    if (known.has(movie.slug)) continue;

    try {
      const sourceUrl = `https://www.sacnilk.com/news/${movie.slug}_Box_Office_Collection_Day_Wise_Worldwide`;
      const row: Record<string, any> = {
        title: movie.title,
        sacnilk_slug: movie.slug,
        language: movie.language,
        source_url: sourceUrl,
        image_url: movie.posterUrl
      };
      if (movie.netCr != null) {
        row.amt = `₹${movie.netCr.toFixed(2)} Cr`;
        row.lifetime_gross = `₹${movie.netCr.toFixed(2)} Cr`;
      }

      const { error: insertError } = await supabaseAdmin.from('now_showing').insert(row);
      if (insertError) throw new Error(insertError.message);

      // It's graduated from upcoming (if it was there) to an actual release.
      await supabaseAdmin.from('upcoming').delete().eq('sacnilk_slug', movie.slug);

      added.push(movie.title);
    } catch (err: any) {
      errors.push({ title: movie.title, message: err?.message ?? String(err) });
    }
  }

  return { added, errors };
}
