import type { Article, BreakingBanner } from './types';

// Public if published (or scheduled) and its time has come. Drafts and
// unpublished articles are never public; nothing is ever deleted.
export function isPublic(a: Pick<Article, 'status' | 'publishAt'>, now: Date): boolean {
  if (a.status !== 'published' && a.status !== 'scheduled') return false;
  if (!a.publishAt) return a.status === 'published';
  return Date.parse(a.publishAt) <= now.getTime();
}

// What the admin list shows: a scheduled article whose time has passed is
// live, so it reads "Published".
export function effectiveStatus(a: Pick<Article, 'status' | 'publishAt'>, now: Date): Article['status'] {
  if (a.status === 'scheduled' && isPublic(a, now)) return 'published';
  return a.status;
}

export function activeBanner(banners: BreakingBanner[], now: Date): BreakingBanner | null {
  const t = now.getTime();
  return banners.filter((b) => b.active && Date.parse(b.startsAt) <= t && Date.parse(b.endsAt) > t).sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0] ?? null;
}

// Status change requested from the admin. Returns the fields to set.
export function applyStatusAction(
  a: Pick<Article, 'status' | 'publishAt' | 'publishedAt'>,
  action: 'publish' | 'schedule' | 'unpublish' | 'revert_to_draft',
  now: Date,
  at?: string
): Pick<Article, 'status' | 'publishAt' | 'publishedAt'> {
  switch (action) {
    case 'publish':
      return { status: 'published', publishAt: now.toISOString(), publishedAt: a.publishedAt ?? now.toISOString() };
    case 'schedule': {
      if (!at || Number.isNaN(Date.parse(at))) throw new Error('Choose a date and time to schedule.');
      if (Date.parse(at) <= now.getTime()) throw new Error('The scheduled time must be in the future.');
      return { status: 'scheduled', publishAt: new Date(at).toISOString(), publishedAt: a.publishedAt };
    }
    case 'unpublish':
      return { status: 'unpublished', publishAt: a.publishAt, publishedAt: a.publishedAt };
    case 'revert_to_draft':
      return { status: 'draft', publishAt: null, publishedAt: a.publishedAt };
  }
}
