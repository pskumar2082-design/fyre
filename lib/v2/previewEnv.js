// Decides, at build time, whether this build is the Fyre v2 Preview sandbox.
// Plain CommonJS so next.config.js can use it; unit-tested in
// lib/v2/__tests__/previewEnv.test.ts.
//
// The sandbox is ON only for a Vercel *Preview* build of a feature/fyre-v2*
// branch (or when FYRE_PREVIEW_SANDBOX=1 is set for a non-production
// build). It is always OFF on Vercel Production, whatever else is set.
//
// In the sandbox every v2 section is switched on and every data source is
// test data held in memory: no Supabase writes, no uploads, no feeds, no
// cron jobs (see middleware.ts).
const SANDBOX_ENV = {
  FYRE_PREVIEW_SANDBOX: '1',
  NEXT_PUBLIC_FYRE_PREVIEW_SANDBOX: '1',
  NEXT_PUBLIC_FYRE_V2: '1',
  SPORTS_ENABLED: '1',
  SPORTS_SOURCE: 'demo',
  SPORTS_SYNC_ENABLED: '0',
  NEWSROOM_ENABLED: '1',
  NEWSROOM_STORE: 'memory',
  MOVIES_V2_ENABLED: '1',
  MOVIES_SOURCE: 'demo'
};

function isPreviewSandboxBuild(env) {
  if (env.VERCEL_ENV === 'production') return false;
  if (env.FYRE_PREVIEW_SANDBOX === '1') return true;
  return env.VERCEL_ENV === 'preview' && /^feature\/fyre-v2/.test(env.VERCEL_GIT_COMMIT_REF || '');
}

function previewSandboxEnv(env) {
  return isPreviewSandboxBuild(env) ? { ...SANDBOX_ENV } : {};
}

module.exports = { isPreviewSandboxBuild, previewSandboxEnv, SANDBOX_ENV };
