import type { Article, Category } from './types';
import { isValidSlug } from './slug';

export type Issue = { field: string; message: string };

const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+/i;

// Rules for saving a draft: only what keeps the record well-formed.
export function draftIssues(a: Partial<Article>, categories: Category[]): Issue[] {
  const issues: Issue[] = [];
  if (!a.headline || !a.headline.trim()) issues.push({ field: 'headline', message: 'Add a headline.' });
  if (a.headline && a.headline.length > 160) issues.push({ field: 'headline', message: 'Keep the headline under 160 characters.' });
  if (!a.section) issues.push({ field: 'section', message: 'Choose News or Politics.' });
  if (!a.category || !categories.some((c) => c.section === a.section && c.slug === a.category)) issues.push({ field: 'category', message: 'Choose a category.' });
  if (a.slug && !isValidSlug(a.slug)) issues.push({ field: 'slug', message: 'Use lowercase letters, numbers and hyphens only.' });
  for (const [i, s] of (a.sources ?? []).entries()) {
    if (!s.name?.trim()) issues.push({ field: `sources.${i}.name`, message: `Source ${i + 1}: add the outlet or body name.` });
    if (!URL_RE.test(s.url ?? '')) issues.push({ field: `sources.${i}.url`, message: `Source ${i + 1}: add a full link (https://...).` });
  }
  return issues;
}

// Extra rules before an article can go public (publish now or schedule).
// These are the editorial rules from the plan, enforced in code.
export function publishIssues(a: Partial<Article>, categories: Category[]): Issue[] {
  const issues = draftIssues(a, categories);
  if (!a.slug) issues.push({ field: 'slug', message: 'Add a URL slug (needed for headlines without English letters).' });
  if (!a.description || a.description.trim().length < 30) issues.push({ field: 'description', message: 'Add a one-line description (at least 30 characters).' });
  const text = (a.bodyHtml ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 200) issues.push({ field: 'bodyHtml', message: 'The article body is too short to publish (at least 200 characters).' });
  if (a.heroImageUrl) {
    if (!a.heroImageAlt?.trim()) issues.push({ field: 'heroImageAlt', message: 'Describe the image for readers who cannot see it (alt text).' });
    if (!a.imageCredit?.trim()) issues.push({ field: 'imageCredit', message: 'Credit the image (photographer, agency, "Fyre" or the official handout).' });
  }
  if (a.section === 'politics') {
    if (!a.sources || a.sources.length === 0) issues.push({ field: 'sources', message: 'Politics articles need at least one source.' });
    if (!a.factCheckedBy?.trim()) issues.push({ field: 'factCheckedBy', message: 'Politics articles need a "fact-checked by" name.' });
  }
  if (a.kind === 'opinion' && !a.author?.trim()) issues.push({ field: 'author', message: 'Opinion pieces need a named author.' });
  return issues;
}

// The editor warns (does not block) when one pasted block is long, as a
// reminder not to copy other outlets' articles.
export const LONG_PASTE_CHARS = 300;
