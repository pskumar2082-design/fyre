// Routes the Vercel Preview sandbox refuses (see middleware.ts). Pure and
// edge-safe so it can run in middleware and be unit-tested.

// The only admin APIs allowed in the sandbox: the v2 newsroom and movies
// tools, which use in-memory test stores there.
const ALLOWED_ADMIN = /^\/api\/admin\/(newsroom|movies-v2)(\/|$)/;

export function blockedInSandbox(pathname: string): boolean {
  if (pathname.startsWith('/api/cron/')) return true; // BFILMY, USA, MovieMint and cricket imports
  if (pathname === '/api/sync-boxoffice' || pathname === '/api/admin-sync-boxoffice') return true; // old Sacnilk sync
  if (pathname.startsWith('/api/admin/') && !ALLOWED_ADMIN.test(pathname)) return true; // legacy admin tools
  return false;
}
