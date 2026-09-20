import { defineConfig } from 'vitest/config';
import path from 'path';

// Test-only config. Dummy Supabase env vars below let lib/supabaseAdmin.ts
// (imported transitively by lib/syncMovieMint.ts) construct a client
// without a real project -- no test here ever actually calls out to
// Supabase; syncMovieMint.ts's DB-touching functions aren't what's under
// test (see the pure buildBreakdownPayload/buildSnapshotPayload/
// resolveMatchCandidates/shouldInsertSnapshot exports it provides
// specifically so they're testable without a live connection).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.')
    }
  },
  test: {
    environment: 'node',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
    }
  }
});
