import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseFetch } from '@/lib/supabaseFetch';

// Admin API routes accept the caller's own Supabase Auth session (the login
// that guards /admin) as `Authorization: Bearer <access token>`. Uses the
// same identity-encoding fetch as lib/supabaseClient.ts (Next's server
// fetch has failed to decompress Supabase responses before).
const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
  global: { fetch: supabaseFetch }
});

export async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const { data, error } = await authClient.auth.getUser(token);
  if (error) console.warn('requireAdmin:', error.message);
  return !error && !!data?.user;
}
