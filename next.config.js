/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        // Supabase Storage public bucket URLs, e.g.
        // https://YOUR-PROJECT.supabase.co/storage/v1/object/public/images/...
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**'
      },
      {
        // Posters synced from a movie's own Sacnilk profile page (see
        // lib/syncMovieProfiles.ts), e.g.
        // https://cdn.sacnilk.com/image/movie/2026/14154.jpg
        protocol: 'https',
        hostname: 'cdn.sacnilk.com',
        pathname: '/image/**'
      },
      {
        // Posters TrackTollywood serves directly from its own WordPress
        // media library (see lib/tracktollywood/scraper.ts), e.g.
        // https://tracktollywood.com/wp-content/smush-webp/2026/09/....jpg.webp
        // -- registered for completeness even though the TrackTollywood
        // pages currently render with `unoptimized` (an external site's
        // images, no need to route them through Vercel's optimizer).
        protocol: 'https',
        hostname: 'tracktollywood.com',
        pathname: '/wp-content/**'
      }
    ]
  },
  // The per-movie page used to live at /tracktollywood/[slug] -- the data
  // source's own name, not fyre's, and it showed up right in the browser
  // address bar. It moved to /movie/[slug] (see app/movie/[slug]/page.tsx);
  // this keeps any link to the old path -- already-shared messages, a
  // browser bookmark, whatever Google indexed off the old sitemap -- landing
  // on the right page instead of a 404, permanently (308) so search engines
  // update their index to the new URL too.
  async redirects() {
    return [
      {
        source: '/tracktollywood/:slug',
        destination: '/movie/:slug',
        permanent: true
      }
    ];
  }
};

module.exports = nextConfig;
