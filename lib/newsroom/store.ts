import type { Article, ArticleInput, BreakingBanner, Category, HomeSection, Revision, Section } from './types';
import { isVercelProduction } from '@/lib/v2/flags';

export type ArticleQuery = {
  section?: Section;
  category?: string;
  statuses?: Article['status'][];
  publicAt?: Date; // only articles public at this moment
  tag?: string;
  search?: string;
  featuredOnly?: boolean;
  limit?: number;
  offset?: number;
};

export interface NewsroomStore {
  kind: 'file' | 'supabase';
  listCategories(): Promise<Category[]>;
  saveCategory(c: Category): Promise<Category>;
  listArticles(q: ArticleQuery): Promise<{ items: Article[]; total: number }>;
  getArticle(id: string): Promise<Article | null>;
  getBySlug(section: Section, slug: string): Promise<Article | null>;
  slugTaken(section: Section, slug: string, exceptId?: string): Promise<boolean>;
  redirectFor?(section: Section, oldSlug: string): Promise<Article | null>;
  saveArticle(input: ArticleInput, editor: string | null, note: string): Promise<Article>;
  setStatus(id: string, fields: Pick<Article, 'status' | 'publishAt' | 'publishedAt'>, editor: string | null, note: string): Promise<Article>;
  listRevisions(id: string): Promise<Revision[]>;
  setFeatured(orderedIds: string[]): Promise<void>;
  listBanners(): Promise<BreakingBanner[]>;
  saveBanner(b: Omit<BreakingBanner, 'id' | 'updatedAt' | 'createdBy'> & { id?: string }, editor: string | null): Promise<BreakingBanner>;
  getHomeSections(): Promise<HomeSection[]>;
  saveHomeSections(s: HomeSection[]): Promise<HomeSection[]>;
  recordView(articleId: string, day: string): Promise<void>;
  viewsSince(day: string): Promise<{ articleId: string; views: number }[]>;
}

export class NewsroomUnavailableError extends Error {}

// NEWSROOM_STORE=supabase in deployed environments (cms_* tables), or
// file for local development (a JSON file under .data/, never committed).
export async function getNewsroomStore(): Promise<NewsroomStore> {
  const kind = process.env.NEWSROOM_STORE ?? 'supabase';
  if (kind === 'file') {
    if (isVercelProduction() || process.env.VERCEL) throw new NewsroomUnavailableError('The local file store cannot run on Vercel');
    const { fileStore } = await import('./store-file');
    return fileStore();
  }
  if (kind === 'supabase') {
    const { supabaseStore } = await import('./store-supabase');
    return supabaseStore;
  }
  throw new NewsroomUnavailableError(`Unknown NEWSROOM_STORE "${kind}"`);
}

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
