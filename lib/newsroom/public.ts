import { newsroomEnabled } from '@/lib/v2/flags';
import { getNewsroomStore } from './store';
import type { Article, BreakingBanner, Category, HomeSection, Section } from './types';
import { DEFAULT_HOME_SECTIONS } from './types';
import { DEFAULT_CATEGORIES } from './categories';
import { activeBanner } from './visibility';

// Read helpers for public pages. A store failure shows empty sections, not
// an error page, and nothing here ever returns a draft.

export async function publicArticles(q: { section?: Section; category?: string; tag?: string; limit?: number; offset?: number; featuredOnly?: boolean } = {}): Promise<Article[]> {
  return (await publicArticlePage(q)).items;
}

export async function publicArticlePage(q: { section?: Section; category?: string; tag?: string; limit?: number; offset?: number; featuredOnly?: boolean } = {}): Promise<{ items: Article[]; total: number }> {
  if (!newsroomEnabled()) return { items: [], total: 0 };
  try {
    const store = await getNewsroomStore();
    return await store.listArticles({ ...q, publicAt: new Date() });
  } catch (err: any) {
    console.error('publicArticles:', err?.message ?? err);
    return { items: [], total: 0 };
  }
}

export async function publicArticle(section: Section, slug: string): Promise<Article | null> {
  if (!newsroomEnabled()) return null;
  const store = await getNewsroomStore();
  const a = await store.getBySlug(section, slug);
  if (!a) return null;
  const now = new Date();
  if (a.status !== 'published' && a.status !== 'scheduled') return null;
  if (!a.publishAt || Date.parse(a.publishAt) > now.getTime()) return null;
  return a;
}

export async function categories(section?: Section): Promise<Category[]> {
  try {
    const store = await getNewsroomStore();
    const all = await store.listCategories();
    return all.filter((c) => (!section || c.section === section) && c.active);
  } catch {
    return DEFAULT_CATEGORIES.filter((c) => !section || c.section === section);
  }
}

export async function currentBanner(): Promise<BreakingBanner | null> {
  if (!newsroomEnabled()) return null;
  try {
    const store = await getNewsroomStore();
    return activeBanner(await store.listBanners(), new Date());
  } catch {
    return null;
  }
}

export async function homeSections(): Promise<HomeSection[]> {
  if (!newsroomEnabled()) return DEFAULT_HOME_SECTIONS;
  try {
    return await (await getNewsroomStore()).getHomeSections();
  } catch {
    return DEFAULT_HOME_SECTIONS;
  }
}

// Trending = most-read public Fyre articles over the last 48 hours.
export async function trendingArticles(limit = 5): Promise<Article[]> {
  if (!newsroomEnabled()) return [];
  try {
    const store = await getNewsroomStore();
    const since = new Date(Date.now() - 2 * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const views = (await store.viewsSince(since)).sort((a, b) => b.views - a.views);
    const recent = (await store.listArticles({ publicAt: new Date(), limit: 60 })).items;
    const byId = new Map(recent.map((a) => [a.id, a]));
    const ranked = views.map((v) => byId.get(v.articleId)).filter((a): a is Article => !!a);
    // Until there are enough views, fill with the newest stories.
    for (const a of recent) if (ranked.length < limit && !ranked.includes(a)) ranked.push(a);
    return ranked.slice(0, limit);
  } catch {
    return [];
  }
}
