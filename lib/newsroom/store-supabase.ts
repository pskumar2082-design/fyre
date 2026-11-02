import { supabase } from '@/lib/supabaseClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { Article, BreakingBanner, Category, HomeSection, Revision } from './types';
import { DEFAULT_HOME_SECTIONS } from './types';
import type { ArticleQuery, NewsroomStore } from './store';

// Supabase newsroom (supabase/migration_cms_1.sql). Public reads go through
// the anon client, so Row Level Security (published-and-due only) applies
// on top of the query's own filter. Admin reads and all writes use the
// service role, and only from authenticated admin API routes.

const toArticle = (r: any): Article => ({
  id: r.id,
  section: r.section,
  category: r.category,
  slug: r.slug,
  headline: r.headline,
  description: r.description ?? '',
  bodyHtml: r.body_html ?? '',
  heroImageUrl: r.hero_image_url,
  heroImageAlt: r.hero_image_alt ?? '',
  imageCredit: r.image_credit ?? '',
  tags: r.tags ?? [],
  sources: r.sources ?? [],
  kind: r.kind,
  status: r.status,
  publishAt: r.publish_at,
  publishedAt: r.published_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  author: r.author,
  featuredRank: r.featured_rank,
  factCheckedBy: r.fact_checked_by,
  factCheckedAt: r.fact_checked_at,
  seoTitle: r.seo_title ?? '',
  seoDescription: r.seo_description ?? '',
  correctionNote: r.correction_note
});

const fromArticle = (a: Partial<Article>) => ({
  section: a.section,
  category: a.category,
  slug: a.slug,
  headline: a.headline,
  description: a.description,
  body_html: a.bodyHtml,
  hero_image_url: a.heroImageUrl,
  hero_image_alt: a.heroImageAlt,
  image_credit: a.imageCredit,
  tags: a.tags,
  sources: a.sources,
  kind: a.kind,
  author: a.author,
  featured_rank: a.featuredRank,
  fact_checked_by: a.factCheckedBy,
  fact_checked_at: a.factCheckedAt,
  seo_title: a.seoTitle,
  seo_description: a.seoDescription,
  correction_note: a.correctionNote
});

const toBanner = (r: any): BreakingBanner => ({ id: r.id, text: r.text, link: r.link, startsAt: r.starts_at, endsAt: r.ends_at, active: r.active, createdBy: r.created_by, updatedAt: r.updated_at });

function check<T>(res: { data: T; error: any }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

async function snapshot(articleId: string, editor: string | null, note: string, article: Article) {
  check(await supabaseAdmin.from('cms_article_revision').insert({ article_id: articleId, edited_by: editor, note, snapshot: article }), 'cms_article_revision');
}

export const supabaseStore: NewsroomStore = {
  kind: 'supabase',
  async listCategories() {
    const rows = check(await supabase.from('cms_category').select('*').order('section').order('sort'), 'cms_category') as any[];
    return rows.map((r) => ({ section: r.section, slug: r.slug, name: r.name, description: r.description ?? '', sort: r.sort, active: r.active }));
  },
  async saveCategory(c: Category) {
    check(await supabaseAdmin.from('cms_category').upsert({ ...c, updated_at: new Date().toISOString() }, { onConflict: 'section,slug' }), 'cms_category');
    return c;
  },
  async listArticles(q: ArticleQuery) {
    const client = q.publicAt ? supabase : supabaseAdmin;
    let query = client.from('cms_article').select('*', { count: 'exact' });
    if (q.section) query = query.eq('section', q.section);
    if (q.category) query = query.eq('category', q.category);
    if (q.statuses) query = query.in('status', q.statuses);
    if (q.publicAt) query = query.in('status', ['published', 'scheduled']).lte('publish_at', q.publicAt.toISOString());
    if (q.tag) query = query.contains('tags', [q.tag.toLowerCase()]);
    if (q.featuredOnly) query = query.not('featured_rank', 'is', null).order('featured_rank');
    if (q.search) query = query.ilike('headline', `%${q.search.replace(/[%_]/g, '')}%`);
    query = q.publicAt ? query.order('publish_at', { ascending: false }) : query.order('updated_at', { ascending: false });
    const offset = q.offset ?? 0;
    const res = await query.range(offset, offset + (q.limit ?? 50) - 1);
    const rows = check(res, 'cms_article') as any[];
    return { items: rows.map(toArticle), total: res.count ?? rows.length };
  },
  async getArticle(id) {
    const r = check(await supabaseAdmin.from('cms_article').select('*').eq('id', id).maybeSingle(), 'cms_article');
    return r ? toArticle(r) : null;
  },
  async getBySlug(section, slug) {
    const r = check(await supabase.from('cms_article').select('*').eq('section', section).eq('slug', slug).maybeSingle(), 'cms_article');
    return r ? toArticle(r) : null;
  },
  async slugTaken(section, slug, exceptId) {
    let q = supabaseAdmin.from('cms_article').select('id').eq('section', section).eq('slug', slug);
    if (exceptId) q = q.neq('id', exceptId);
    return (check(await q, 'cms_article') as any[]).length > 0;
  },
  async redirectFor(section, oldSlug) {
    const r = check(await supabase.from('cms_slug_redirect').select('article_id').eq('section', section).eq('old_slug', oldSlug).maybeSingle(), 'cms_slug_redirect') as any;
    if (!r) return null;
    const a = check(await supabase.from('cms_article').select('*').eq('id', r.article_id).maybeSingle(), 'cms_article');
    return a ? toArticle(a) : null;
  },
  async saveArticle(input, editor, note) {
    const row = { ...fromArticle(input), updated_at: new Date().toISOString() };
    let saved: any;
    if (input.id) {
      const before = check(await supabaseAdmin.from('cms_article').select('section, slug').eq('id', input.id).single(), 'cms_article') as any;
      saved = check(await supabaseAdmin.from('cms_article').update(row).eq('id', input.id).select('*').single(), 'cms_article');
      // A changed slug keeps the old URL working through a redirect.
      if (before && (before.slug !== saved.slug || before.section !== saved.section)) {
        check(await supabaseAdmin.from('cms_slug_redirect').upsert({ section: before.section, old_slug: before.slug, article_id: saved.id }, { onConflict: 'section,old_slug' }), 'cms_slug_redirect');
      }
    } else {
      saved = check(await supabaseAdmin.from('cms_article').insert({ ...row, status: 'draft' }).select('*').single(), 'cms_article');
    }
    const article = toArticle(saved);
    await snapshot(article.id, editor, note, article);
    return article;
  },
  async setStatus(id, fields, editor, note) {
    const saved = check(
      await supabaseAdmin
        .from('cms_article')
        .update({ status: fields.status, publish_at: fields.publishAt, published_at: fields.publishedAt, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single(),
      'cms_article'
    );
    const article = toArticle(saved);
    await snapshot(id, editor, note, article);
    return article;
  },
  async listRevisions(id) {
    const rows = check(await supabaseAdmin.from('cms_article_revision').select('*').eq('article_id', id).order('edited_at', { ascending: false }).limit(100), 'cms_article_revision') as any[];
    return rows.map((r): Revision => ({ id: r.id, articleId: r.article_id, editedBy: r.edited_by, editedAt: r.edited_at, note: r.note ?? '', snapshot: r.snapshot }));
  },
  async setFeatured(orderedIds) {
    check(await supabaseAdmin.from('cms_article').update({ featured_rank: null }).not('featured_rank', 'is', null), 'cms_article');
    for (const [i, id] of orderedIds.slice(0, 5).entries()) check(await supabaseAdmin.from('cms_article').update({ featured_rank: i + 1 }).eq('id', id), 'cms_article');
  },
  async listBanners() {
    const rows = check(await supabase.from('cms_breaking_banner').select('*').order('starts_at', { ascending: false }).limit(50), 'cms_breaking_banner') as any[];
    return rows.map(toBanner);
  },
  async saveBanner(b, editor) {
    const now = new Date().toISOString();
    if (b.active) check(await supabaseAdmin.from('cms_breaking_banner').update({ active: false, updated_at: now }).eq('active', true).neq('id', b.id ?? '00000000-0000-0000-0000-000000000000'), 'cms_breaking_banner');
    const row = { text: b.text, link: b.link, starts_at: b.startsAt, ends_at: b.endsAt, active: b.active, updated_at: now };
    const saved = b.id
      ? check(await supabaseAdmin.from('cms_breaking_banner').update(row).eq('id', b.id).select('*').single(), 'cms_breaking_banner')
      : check(await supabaseAdmin.from('cms_breaking_banner').insert({ ...row, created_by: editor }).select('*').single(), 'cms_breaking_banner');
    return toBanner(saved);
  },
  async getHomeSections() {
    const rows = check(await supabase.from('cms_home_section').select('*').order('sort'), 'cms_home_section') as any[];
    if (!rows.length) return DEFAULT_HOME_SECTIONS;
    return rows.map((r) => ({ key: r.key, label: r.label, enabled: r.enabled, sort: r.sort }));
  },
  async saveHomeSections(s: HomeSection[]) {
    const rows = s.map((x, i) => ({ key: x.key, label: x.label, enabled: x.enabled, sort: i + 1 }));
    check(await supabaseAdmin.from('cms_home_section').upsert(rows, { onConflict: 'key' }), 'cms_home_section');
    return rows as HomeSection[];
  },
  async recordView(articleId, day) {
    check(await supabaseAdmin.rpc('cms_record_view', { p_article: articleId, p_day: day }), 'cms_record_view');
  },
  async viewsSince(day) {
    const rows = check(await supabaseAdmin.from('cms_article_view_day').select('article_id, views').gte('day', day), 'cms_article_view_day') as any[];
    const by = new Map<string, number>();
    for (const r of rows) by.set(r.article_id, (by.get(r.article_id) ?? 0) + r.views);
    return [...by.entries()].map(([articleId, views]) => ({ articleId, views }));
  }
};
