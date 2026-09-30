import { createClient } from '@supabase/supabase-js';
import { supabaseFetch } from '@/lib/supabaseFetch';

export { supabaseFetch };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supabase's REST endpoint (fronted by Cloudflare) gzips any response
// past a small size threshold -- which every `select('*')` on an article
// with real body text hits. In a Node.js server context (both `next dev`
// and a plain `next start`, confirmed directly: same article, same
// query, gzip response bytes coming back unparsed as raw gzip instead of
// JSON -- error.message was literally the gzip bytes) something between
// Node's fetch and Next's own fetch instrumentation fails to
// auto-decompress it, so the JSON parse throws and every list/detail
// page for an article with real content silently looks like "no rows".
// Asking for `identity` (no compression) sidesteps the whole codepath --
// confirmed directly against the real endpoint: same query, Content-
// Encoding simply isn't set on the response, plain JSON back. This
// header is a "forbidden header name" everywhere except a real Node
// fetch, so setting it here is a no-op in the browser (where this same
// client is also used) and only takes effect for the server-side reads
// it's actually fixing.

// Single shared client for both server components (read-only, anon key is
// fine because of the public-read RLS policies) and the browser (admin
// writes happen only after the user is signed in via Supabase Auth).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: supabaseFetch }
});
