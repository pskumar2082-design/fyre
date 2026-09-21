import type { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabaseClient';
import { getLiveMovies, getCompletedMovies } from '@/lib/tracktollywood/scraper';
import { SITE_URL } from '@/lib/siteConfig';

// This is what actually gets every movie/news/review page in front of
// Google, not just the homepage -- the gap that mattered most, since
// this site had no sitemap at all before. Next.js serves this
// automatically at /sitemap.xml. Movie pages come from the same live
// TrackTollywood scrape the rest of the site uses (so a new movie is in
// the sitemap the moment it's in the live listing, no manual step), and
// news/reviews come straight from Supabase.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'always', priority: 1 },
    { url: `${SITE_URL}/box-office`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/now-showing`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/upcoming`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/news`, changeFrequency: 'hourly', priority: 0.7 },
    { url: `${SITE_URL}/reviews`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/search`, changeFrequency: 'monthly', priority: 0.3 }
  ];

  const [live, completed, newsRes, reviewsRes] = await Promise.all([
    getLiveMovies().catch(() => []),
    getCompletedMovies().catch(() => []),
    supabase.from('news').select('id, created_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('reviews').select('id, created_at').order('created_at', { ascending: false }).limit(500)
  ]);

  // A slug can appear in both the live and completed listings during the
  // handover window (a movie's last live day / first archived day) --
  // de-dupe so the sitemap never lists the same URL twice.
  const slugs = new Set([...live.map((m) => m.slug), ...completed.map((m) => m.slug)]);
  const movieRoutes: MetadataRoute.Sitemap = [...slugs].map((slug) => ({
    url: `${SITE_URL}/tracktollywood/${slug}`,
    changeFrequency: 'hourly',
    priority: 0.85
  }));

  const newsRoutes: MetadataRoute.Sitemap = (newsRes.data ?? []).map((n) => ({
    url: `${SITE_URL}/news/${n.id}`,
    lastModified: n.created_at ? new Date(n.created_at) : undefined,
    changeFrequency: 'weekly',
    priority: 0.6
  }));

  const reviewRoutes: MetadataRoute.Sitemap = (reviewsRes.data ?? []).map((r) => ({
    url: `${SITE_URL}/reviews/${r.id}`,
    lastModified: r.created_at ? new Date(r.created_at) : undefined,
    changeFrequency: 'weekly',
    priority: 0.6
  }));

  return [...staticRoutes, ...movieRoutes, ...newsRoutes, ...reviewRoutes];
}
