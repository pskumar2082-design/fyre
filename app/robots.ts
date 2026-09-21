import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteConfig';

// Served automatically at /robots.txt. /admin and /api are the site's
// own tooling (the sync dashboard, the cron/scrape endpoints) -- no
// reason for either to show up in search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api']
    },
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
