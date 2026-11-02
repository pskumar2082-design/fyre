// Fyre v2 feature switches. Every new section ships OFF: production has none
// of these variables set, so production keeps rendering exactly what it does
// today until each switch is turned on with explicit approval.
//
//   NEXT_PUBLIC_FYRE_V2=1   new navigation (Movies | Sports | Latest News |
//                           Politics) and the new homepage
//   SPORTS_ENABLED=1        /sports, /live-scores, /sports/cricket/*
//   NEWSROOM_ENABLED=1      Fyre's own newsroom on /news and /politics
//   MOVIES_V2_ENABLED=1     /movies hub on the new movie data model
//
// Data sources are separate switches, so turning a section on never turns a
// feed on by itself:
//   SPORTS_SOURCE   demo (labelled test data) | store (Supabase sp_* tables)
//   NEWSROOM_STORE  file (local dev only)     | supabase (cms_* tables)
//   MOVIES_SOURCE   demo (labelled test data) | store (Supabase mv_* tables)

export function fyreV2(): boolean {
  return process.env.NEXT_PUBLIC_FYRE_V2 === '1';
}

export function sportsEnabled(): boolean {
  return process.env.SPORTS_ENABLED === '1';
}

export function newsroomEnabled(): boolean {
  return process.env.NEWSROOM_ENABLED === '1';
}

export function moviesV2Enabled(): boolean {
  return process.env.MOVIES_V2_ENABLED === '1';
}

// True on Vercel's production deployment. Labelled test data and the local
// file store refuse to run there, so a mis-set variable can never publish
// test scores or sample articles on fyre.co.in.
export function isVercelProduction(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

// Local admin preview without signing in: only under `next dev` on a
// developer machine, never in a production build (NODE_ENV is 'production'
// there, which makes this false), and only when explicitly asked for.
export function adminDevPreview(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.ADMIN_DEV_PREVIEW === '1' && !process.env.VERCEL;
}
