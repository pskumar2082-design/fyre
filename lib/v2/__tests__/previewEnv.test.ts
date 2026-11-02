import { describe, expect, it } from 'vitest';
const { isPreviewSandboxBuild, previewSandboxEnv } = require('../previewEnv.js');

describe('Preview sandbox switch', () => {
  it('is on for a Vercel Preview build of a feature/fyre-v2 branch', () => {
    expect(isPreviewSandboxBuild({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/fyre-v2-phase1' })).toBe(true);
    expect(previewSandboxEnv({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/fyre-v2-phase1' })).toMatchObject({ NEWSROOM_STORE: 'memory', SPORTS_SOURCE: 'demo', MOVIES_SOURCE: 'demo', SPORTS_SYNC_ENABLED: '0' });
  });
  it('is never on for Vercel Production, even if asked', () => {
    expect(isPreviewSandboxBuild({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'feature/fyre-v2-phase1', FYRE_PREVIEW_SANDBOX: '1' })).toBe(false);
    expect(previewSandboxEnv({ VERCEL_ENV: 'production', FYRE_PREVIEW_SANDBOX: '1' })).toEqual({});
  });
  it('is off for previews of other branches and for normal local builds', () => {
    expect(isPreviewSandboxBuild({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'integration/moviemint-india' })).toBe(false);
    expect(isPreviewSandboxBuild({ VERCEL_ENV: 'preview' })).toBe(false);
    expect(isPreviewSandboxBuild({})).toBe(false);
  });
  it('can be forced on for a local rehearsal build', () => {
    expect(isPreviewSandboxBuild({ FYRE_PREVIEW_SANDBOX: '1' })).toBe(true);
  });
});

import { blockedInSandbox } from '../sandboxRoutes';

describe('Preview sandbox route guard', () => {
  it('blocks every import, cron and legacy admin route', () => {
    for (const p of ['/api/cron/bfilmy', '/api/cron/usa', '/api/cron/moviemint', '/api/cron/cricket', '/api/sync-boxoffice', '/api/admin-sync-boxoffice', '/api/admin/catalog', '/api/admin/tracked', '/api/admin/daily-report', '/api/admin/x-post', '/api/admin/source-status', '/api/admin/newsroomx'])
      expect(blockedInSandbox(p), p).toBe(true);
  });
  it('allows the v2 newsroom and movies admin and all public read routes', () => {
    for (const p of ['/api/admin/newsroom/articles', '/api/admin/newsroom/articles/abc', '/api/admin/newsroom/upload', '/api/admin/movies-v2', '/api/newsroom/view', '/api/movies/live', '/api/analytics/stats'])
      expect(blockedInSandbox(p), p).toBe(false);
  });
});
