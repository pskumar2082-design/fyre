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
      }
    ]
  }
};

module.exports = nextConfig;
