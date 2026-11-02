import type { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabaseClient';
import { getLiveMovies, getCompletedMovies } from '@/lib/bfilmy/source';
import { SITE_URL } from '@/lib/siteConfig';
import { newsroomEnabled, sportsEnabled, moviesV2Enabled } from '@/lib/v2/flags';
import { publicArticles, categories } from '@/lib/newsroom/public';
import { articlePath } from '@/lib/newsroom/categories';

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
    url: `${SITE_URL}/movie/${slug}`,
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

  // Fyre v2 sections, each only once its switch is on. Sample articles
  // (local test content) are never listed.
  const v2Routes: MetadataRoute.Sitemap = [];
  if (sportsEnabled()) for (const p of ['/sports', '/live-scores', '/sports/cricket']) v2Routes.push({ url: `${SITE_URL}${p}`, changeFrequency: 'hourly', priority: 0.8 });
  if (moviesV2Enabled()) v2Routes.push({ url: `${SITE_URL}/movies`, changeFrequency: 'hourly', priority: 0.9 });
  if (newsroomEnabled()) {
    v2Routes.push({ url: `${SITE_URL}/politics`, changeFrequency: 'hourly', priority: 0.8 }, { url: `${SITE_URL}/editorial-policy`, changeFrequency: 'yearly', priority: 0.2 });
    for (const c of await categories()) v2Routes.push({ url: `${SITE_URL}/${c.section}/${c.slug}`, changeFrequency: 'hourly', priority: 0.6 });
    for (const a of await publicArticles({ limit: 500 })) if (!a.isSample) v2Routes.push({ url: `${SITE_URL}${articlePath(a)}`, lastModified: new Date(a.updatedAt), changeFrequency: 'weekly', priority: 0.7 });
  }

  return [...staticRoutes, ...v2Routes, ...movieRoutes, ...newsRoutes, ...reviewRoutes];
}
