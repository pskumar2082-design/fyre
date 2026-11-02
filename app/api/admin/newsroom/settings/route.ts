import { NextRequest, NextResponse } from 'next/server';
import { v2Admin } from '@/lib/v2/adminGuard';
import { getNewsroomStore } from '@/lib/newsroom/store';
import { isValidSlug } from '@/lib/newsroom/slug';
import { DEFAULT_HOME_SECTIONS, type HomeSection } from '@/lib/newsroom/types';
import { revalidateNewsroom } from '@/lib/newsroom/revalidate';

export const dynamic = 'force-dynamic';

// Categories, breaking-news banners, homepage sections and featured stories.
export async function GET(req: NextRequest) {
  if (!(await v2Admin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const store = await getNewsroomStore();
  const [categories, banners, home, featured] = await Promise.all([store.listCategories(), store.listBanners(), store.getHomeSections(), store.listArticles({ featuredOnly: true, limit: 5 })]);
  return NextResponse.json({ categories, banners, home, featured: featured.items.map((a) => ({ id: a.id, headline: a.headline, section: a.section, status: a.status })), store: store.kind });
}

export async function POST(req: NextRequest) {
  const editor = await v2Admin(req);
  if (!editor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const store = await getNewsroomStore();
  try {
    switch (body?.type) {
      case 'category': {
        const c = body.category ?? {};
        if (c.section !== 'news' && c.section !== 'politics') throw new Error('Choose News or Politics.');
        if (!isValidSlug(String(c.slug ?? ''))) throw new Error('Category slug: lowercase letters, numbers and hyphens.');
        if (!String(c.name ?? '').trim()) throw new Error('Category name is required.');
        const saved = await store.saveCategory({ section: c.section, slug: c.slug, name: String(c.name).trim().slice(0, 60), description: String(c.description ?? '').slice(0, 200), sort: Number(c.sort) || 99, active: c.active !== false });
        revalidateNewsroom();
        return NextResponse.json({ category: saved });
      }
      case 'banner': {
        const b = body.banner ?? {};
        const text = String(b.text ?? '').trim();
        if (!text) throw new Error('Banner text is required.');
        if (text.length > 140) throw new Error('Keep the banner under 140 characters.');
        const startsAt = b.startsAt ? new Date(b.startsAt) : new Date();
        const endsAt = new Date(b.endsAt);
        if (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) throw new Error('Choose an end time after the start time.');
        const link = String(b.link ?? '').trim();
        if (link && !/^(\/|https:\/\/)/.test(link)) throw new Error('Link must start with / or https://');
        const saved = await store.saveBanner({ id: b.id || undefined, text, link: link || null, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), active: b.active !== false }, editor);
        revalidateNewsroom();
        return NextResponse.json({ banner: saved });
      }
      case 'home': {
        const keys = new Set(DEFAULT_HOME_SECTIONS.map((s) => s.key));
        const sections: HomeSection[] = (Array.isArray(body.sections) ? body.sections : []).filter((s: any) => keys.has(s?.key)).map((s: any, i: number) => ({ key: s.key, label: DEFAULT_HOME_SECTIONS.find((d) => d.key === s.key)!.label, enabled: !!s.enabled, sort: i + 1 }));
        if (sections.length !== keys.size) throw new Error('Every homepage section must be listed once.');
        await store.saveHomeSections(sections);
        if (Array.isArray(body.featuredIds)) await store.setFeatured(body.featuredIds.filter((x: unknown) => typeof x === 'string').slice(0, 5));
        revalidateNewsroom();
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: 'Unknown setting' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed' }, { status: 422 });
  }
}
