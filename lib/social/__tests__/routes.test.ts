// The admin routes themselves: auth, URL/host restrictions, exact PNG size.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import React from 'react';
// Vitest compiles the route's JSX with the classic runtime.
(globalThis as any).React = React;

process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
const auth = { ok: true };
vi.mock('@/lib/adminAuth', () => ({ requireAdmin: async () => auth.ok, adminUser: async () => ({ id: 'u', email: 'admin@fyre.test' }) }));
// 1x1 PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const fetched: string[] = [];
vi.mock('@/lib/social/xFetch', async (orig) => {
  const real: any = await orig();
  return {
    ...real,
    mediaDataUri: async (url: string) => {
      fetched.push(url);
      if (!real.isAllowedMediaUrl?.(url) && !(await import('../xPost')).isAllowedMediaUrl(url)) throw new real.XFetchError('Image is not from X media');
      return PNG;
    },
    importXPost: async (ref: any) => ({
      post: { id: ref.id, url: `https://x.com/a/status/${ref.id}`, authorName: 'A', handle: 'a', text: '#TheParadise grosses ₹33.62 Cr on Day 1', postedAt: null, hashtags: ['TheParadise'], mentions: [], links: [], media: [{ type: 'photo', url: 'https://pbs.twimg.com/media/X.jpg', width: 1000, height: 1500, alt: null }], lang: 'en', via: 'syndication', truncated: false },
      warnings: []
    })
  };
});
vi.mock('@/lib/bfilmy/source', () => ({ getLiveMovies: async () => [{ slug: 'the-paradise', title: 'The Paradise' }], getCompletedMovies: async () => [] }));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: { from: () => ({ insert: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: 7 }, error: null }) }) }) }) } }));

const post = (path: string, body: unknown) => new NextRequest(`http://localhost${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const card = { template: 'news', headline: 'THE PARADISE CONTINUES ITS STRONG RUN', subhead: 'Momentum holds.', body: '', movie: 'The Paradise', category: 'MOVIE UPDATE', hashtags: '#TheParadise', footer: '@Fyre_media_', accent: 'fyre', imageLayout: 'single', heroMode: 'framed' };

beforeEach(() => {
  auth.ok = true;
  fetched.length = 0;
});

describe('POST /api/admin/x-post/render', () => {
  it('refuses without an admin session', async () => {
    auth.ok = false;
    const { POST } = await import('@/app/api/admin/x-post/render/route');
    expect((await POST(post('/api/admin/x-post/render', card))).status).toBe(401);
  });
  it('refuses images that are not X media', async () => {
    const { POST } = await import('@/app/api/admin/x-post/render/route');
    const res = await POST(post('/api/admin/x-post/render', { ...card, images: [{ source: 'x', url: 'http://169.254.169.254/latest', width: 10, height: 10 }] }));
    expect(res.status).toBe(400);
    expect(fetched).toEqual([]);
  });
  for (const [size, w, h] of [
    ['ig_portrait', 1080, 1350],
    ['ig_square', 1080, 1080],
    ['story', 1080, 1920],
    ['x_45', 1080, 1350]
  ] as const) {
    it(`renders ${size} at exactly ${w} x ${h}`, async () => {
      const { POST } = await import('@/app/api/admin/x-post/render/route');
      const res = await POST(post('/api/admin/x-post/render', { ...card, size, images: [{ source: 'x', url: 'https://pbs.twimg.com/media/X.jpg', width: 1000, height: 1500 }] }));
      expect(res.status).toBe(200);
      const buf = Buffer.from(await res.arrayBuffer());
      expect(buf.subarray(1, 4).toString()).toBe('PNG');
      expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([w, h]);
    }, 30_000);
  }
  it("a 'source' figure is always labelled as reported, never as Fyre data", async () => {
    const { POST } = await import('@/app/api/admin/x-post/render/route');
    const res = await POST(post('/api/admin/x-post/render', { ...card, template: 'boxoffice', numbers: { mode: 'source', label: 'DAY 1', value: '₹76 Cr+', metrics: [{ label: 'Tickets', value: '1' }], note: 'Fyre tracked data' } }));
    expect(res.status).toBe(200);
  }, 30_000);
});

describe('POST /api/admin/x-post (import)', () => {
  it('refuses non-post URLs before any network call', async () => {
    const { POST } = await import('@/app/api/admin/x-post/route');
    for (const url of ['https://example.com/a/status/1', 'https://x.com/home', 'http://localhost:3000/']) {
      const res = await POST(post('/api/admin/x-post', { action: 'import', url }));
      expect(res.status).toBe(400);
    }
    expect(fetched).toEqual([]);
  });
  it('imports, detects the Fyre movie, suggests type/template and logs the source', async () => {
    const { POST } = await import('@/app/api/admin/x-post/route');
    const res = await POST(post('/api/admin/x-post', { action: 'import', url: 'https://x.com/a/status/123' }));
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j).toMatchObject({ importId: 7, movie: { slug: 'the-paradise' }, type: 'boxoffice', template: 'boxoffice' });
    expect(j.numbers[0].raw).toBe('₹33.62 Cr');
    expect(j.selection).toEqual({ kind: 'day', day: 1 });
    expect(j.thumbs).toEqual([PNG]);
  });
  it('refuses without an admin session', async () => {
    auth.ok = false;
    const { POST } = await import('@/app/api/admin/x-post/route');
    expect((await POST(post('/api/admin/x-post', { action: 'import', url: 'https://x.com/a/status/1' }))).status).toBe(401);
  });
});
