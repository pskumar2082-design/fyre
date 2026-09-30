import { createClient } from '@supabase/supabase-js';
import { supabaseFetch } from '@/lib/supabaseFetch';

// Server-only Supabase client using the SERVICE ROLE key, which bypasses
// Row Level Security entirely. Never import this from a file that can end
// up in the browser bundle — only from Route Handlers / server code
// (app/api/*/route.ts). The anon-key `supabase` client in
// lib/supabaseClient.ts is what every page and the admin UI should keep
// using; this one exists purely so the scheduled box-office sync can write
// to daily_collections, which has no public write policy on purpose.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Same identity-encoding fetch as the public client (see
// lib/supabaseClient.ts): Next's server-side fetch has failed to
// decompress Supabase's compressed responses.
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  global: { fetch: supabaseFetch }
});
