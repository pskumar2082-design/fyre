import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Single shared client for both server components (read-only, anon key is
// fine because of the public-read RLS policies) and the browser (admin
// writes happen only after the user is signed in via Supabase Auth).
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
