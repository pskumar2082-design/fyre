import { describe, it, expect, vi, afterEach } from 'vitest';

// supabaseClient.ts reads these at module load time (`process.env.X!`),
// so they need to be set before it's imported -- real values don't
// matter, this test never makes a real request. `import` statements are
// hoisted above ordinary statements in ESM, so setting process.env in a
// plain statement here would run too late; vi.hoisted() forces this to
// run first.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
});

import { supabaseFetch } from '../supabaseClient';

// Regression test for a real production/dev bug: Supabase's REST
// endpoint gzips any response over a small size threshold, and
// something in the Node/Next fetch pipeline was failing to
// auto-decompress it (confirmed directly against the live endpoint --
// see the comment in supabaseClient.ts), so every article with real
// body text silently came back as "no rows". Asking for `identity`
// (no compression) sidesteps it, but only if the header actually
// reaches the request -- the first attempt at this fix used `{
// ...init?.headers, ... }`, which silently drops everything when
// `init.headers` is a real Headers instance (not a plain object),
// stripping supabase-js's own `apikey`/`Authorization` headers and
// breaking every request outright. These tests pin both requirements:
// Accept-Encoding is always set, and every shape of incoming headers
// supabase-js might pass is preserved alongside it.
describe('supabaseFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchAndCall(init?: RequestInit) {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    supabaseFetch('https://example.supabase.co/rest/v1/news', init);
    const calledHeaders = fetchSpy.mock.calls[0][1]?.headers as Headers;
    return calledHeaders;
  }

  it('sets Accept-Encoding: identity when no headers were passed', () => {
    const headers = mockFetchAndCall(undefined);
    expect(headers.get('Accept-Encoding')).toBe('identity');
  });

  it('preserves a plain-object apikey/Authorization header while adding Accept-Encoding', () => {
    const headers = mockFetchAndCall({
      headers: { apikey: 'test-anon-key', Authorization: 'Bearer test-anon-key' }
    });
    expect(headers.get('apikey')).toBe('test-anon-key');
    expect(headers.get('Authorization')).toBe('Bearer test-anon-key');
    expect(headers.get('Accept-Encoding')).toBe('identity');
  });

  it('preserves a real Headers instance -- the shape that broke the first attempt', () => {
    const original = new Headers({ apikey: 'test-anon-key', Authorization: 'Bearer test-anon-key' });
    const headers = mockFetchAndCall({ headers: original });
    expect(headers.get('apikey')).toBe('test-anon-key');
    expect(headers.get('Authorization')).toBe('Bearer test-anon-key');
    expect(headers.get('Accept-Encoding')).toBe('identity');
  });

  it('preserves an array-of-tuples headers input', () => {
    const headers = mockFetchAndCall({
      headers: [
        ['apikey', 'test-anon-key'],
        ['Authorization', 'Bearer test-anon-key']
      ]
    });
    expect(headers.get('apikey')).toBe('test-anon-key');
    expect(headers.get('Authorization')).toBe('Bearer test-anon-key');
    expect(headers.get('Accept-Encoding')).toBe('identity');
  });
});
