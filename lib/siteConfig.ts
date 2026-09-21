// Single source of truth for the site's own URL/name/description, used by
// every metadata export, the sitemap, robots.txt, and structured data.
// Reads NEXT_PUBLIC_SITE_URL so switching to a custom domain later is a
// one-line env var change in Vercel -- not a code change -- and falls
// back to the current Vercel URL so nothing breaks before that's set.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://fyre-tau.vercel.app').replace(/\/$/, '');

export const SITE_NAME = 'fyre';

export const SITE_DESCRIPTION =
  'Live Telugu movie box office collections, day-wise breakdowns, release dates, cast & crew, news and reviews — updated daily.';
