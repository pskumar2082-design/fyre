import type { NextRequest } from 'next/server';
import { adminUser } from '@/lib/adminAuth';
import { adminDevPreview } from './flags';

// The signed-in admin's email for v2 admin routes, or null when the caller
// is not signed in. Same Supabase session check as every other admin route.
// Under `next dev` with ADMIN_DEV_PREVIEW=1 (local screenshots only) a
// placeholder editor is used instead; that branch cannot run in a
// production build.
export async function v2Admin(req: NextRequest): Promise<string | null> {
  if (adminDevPreview()) return 'local-preview@fyre.test';
  const u = await adminUser(req);
  return u ? (u.email ?? u.id) : null;
}
