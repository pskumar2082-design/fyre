import type { Article, ArticleInput, Category } from './types';
import type { NewsroomStore } from './store';
import { slugify, uniqueSlug } from './slug';
import { draftIssues, publishIssues, type Issue } from './validate';
import { applyStatusAction } from './visibility';
import { sanitizeArticleHtml } from '@/lib/richText/sanitize';

// Server-side admin actions shared by the API routes. Every save keeps a
// revision; nothing here deletes an article.

export class ValidationError extends Error {
  constructor(public issues: Issue[]) {
    super(issues.map((i) => i.message).join(' '));
  }
}

const KINDS = ['report', 'analysis', 'opinion', 'explainer'];

export function cleanInput(raw: any): ArticleInput {
  const str = (v: unknown, max = 10_000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : undefined,
    section: raw?.section === 'politics' ? 'politics' : 'news',
    category: str(raw?.category, 60),
    slug: str(raw?.slug, 80).toLowerCase(),
    headline: str(raw?.headline, 160),
    description: str(raw?.description, 300),
    bodyHtml: sanitizeArticleHtml(typeof raw?.bodyHtml === 'string' ? raw.bodyHtml : ''),
    heroImageUrl: str(raw?.heroImageUrl, 1000) || null,
    heroImageAlt: str(raw?.heroImageAlt, 300),
    imageCredit: str(raw?.imageCredit, 200),
    tags: Array.isArray(raw?.tags) ? [...new Set(raw.tags.map((t: unknown) => str(t, 40).toLowerCase()).filter(Boolean))].slice(0, 12) as string[] : [],
    sources: Array.isArray(raw?.sources)
      ? raw.sources.slice(0, 20).map((s: any) => ({ name: str(s?.name, 200), url: str(s?.url, 1000), checkedOn: /^\d{4}-\d{2}-\d{2}$/.test(s?.checkedOn ?? '') ? s.checkedOn : new Date().toISOString().slice(0, 10) }))
      : [],
    kind: KINDS.includes(raw?.kind) ? raw.kind : 'report',
    author: str(raw?.author, 120) || null,
    featuredRank: null,
    factCheckedBy: str(raw?.factCheckedBy, 120) || null,
    factCheckedAt: raw?.factCheckedBy ? new Date().toISOString() : null,
    seoTitle: str(raw?.seoTitle, 70),
    seoDescription: str(raw?.seoDescription, 160),
    correctionNote: str(raw?.correctionNote, 1000) || null
  };
}

export async function saveDraft(store: NewsroomStore, raw: any, editor: string): Promise<Article> {
  const input = cleanInput(raw);
  const cats = await store.listCategories();
  const existing = input.id ? await store.getArticle(input.id) : null;
  if (input.id && !existing) throw new ValidationError([{ field: 'id', message: 'That article no longer exists.' }]);
  // Keep the existing featured rank; it is set from the Homepage panel.
  input.featuredRank = existing?.featuredRank ?? null;
  if (existing?.factCheckedBy === input.factCheckedBy) input.factCheckedAt = existing.factCheckedAt;
  if (!input.slug) input.slug = slugify(input.headline);
  if (input.slug && (await store.slugTaken(input.section, input.slug, input.id))) {
    const taken = new Set<string>();
    for (let i = 2; i < 50; i++) if (await store.slugTaken(input.section, `${input.slug}-${i}`, input.id)) taken.add(`${input.slug}-${i}`);
    taken.add(input.slug);
    input.slug = uniqueSlug(input.slug, taken);
  }
  // A published article's URL is fixed unless the editor changes the slug
  // on purpose; the old URL then redirects (cms_slug_redirect).
  const issues = draftIssues(input, cats);
  if (issues.length) throw new ValidationError(issues);
  // Editing a live article re-checks the publish rules so it cannot slip below them.
  if (existing && (existing.status === 'published' || existing.status === 'scheduled')) {
    const pi = publishIssues(input, cats);
    if (pi.length) throw new ValidationError(pi);
  }
  return store.saveArticle(input, editor, existing ? 'Edited' : 'Created');
}

export async function changeStatus(store: NewsroomStore, id: string, action: string, at: string | undefined, editor: string): Promise<Article> {
  const a = await store.getArticle(id);
  if (!a) throw new ValidationError([{ field: 'id', message: 'Article not found.' }]);
  if (action !== 'publish' && action !== 'schedule' && action !== 'unpublish' && action !== 'revert_to_draft') throw new ValidationError([{ field: 'action', message: 'Unknown action.' }]);
  if (action === 'publish' || action === 'schedule') {
    const cats: Category[] = await store.listCategories();
    const issues = publishIssues(a, cats);
    if (issues.length) throw new ValidationError(issues);
  }
  let fields;
  try {
    fields = applyStatusAction(a, action, new Date(), at);
  } catch (err: any) {
    throw new ValidationError([{ field: 'publishAt', message: err.message }]);
  }
  const note = { publish: 'Published', schedule: `Scheduled for ${fields.publishAt}`, unpublish: 'Unpublished', revert_to_draft: 'Moved back to draft' }[action];
  return store.setStatus(id, fields, editor, note);
}

export async function restoreRevision(store: NewsroomStore, id: string, revisionId: string, editor: string): Promise<Article> {
  const revs = await store.listRevisions(id);
  const r = revs.find((x) => x.id === revisionId);
  if (!r) throw new ValidationError([{ field: 'revision', message: 'Revision not found.' }]);
  // Restores the words and settings, not the status: a restored version of
  // a live article stays live only if it still meets the publish rules.
  const { id: _i, status: _s, publishAt: _p, publishedAt: _pp, createdAt: _c, updatedAt: _u, ...rest } = r.snapshot;
  return saveDraft(store, { ...rest, id }, editor);
}
