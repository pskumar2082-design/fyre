/** @type {import('next').NextConfig} */
const nextConfig = {
  // @sparticuz/chromium + puppeteer-core (see lib/moviemintBrowserRenderer.ts)
  // ship a native Chromium binary that must be resolved by RELATIVE PATH at
  // runtime -- bundling it into the function like ordinary JS breaks that.
  // serverComponentsExternalPackages keeps both packages un-bundled;
  // outputFileTracingIncludes makes sure Vercel's file tracer still copies
  // the binary itself into the two MovieMint API routes' deployed output
  // (Next.js's tracer can't see a require() the package does dynamically,
  // so without this the binary silently isn't there at runtime even though
  // everything works locally). Both routes are also pinned to the Node.js
  // runtime in their own files (export const runtime = 'nodejs') since the
  // compiled binary cannot run under the Edge runtime at all.
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
    outputFileTracingIncludes: {
      '/api/sync-moviemint/route': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/api/sync-moviemint': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/api/admin-sync-moviemint/route': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/api/admin-sync-moviemint': ['./node_modules/@sparticuz/chromium/bin/**']
    }
  },
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
      }
    ]
  }
};

module.exports = nextConfig;
