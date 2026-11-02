import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isValidSlug, slugify, uniqueSlug } from '../slug';
import { draftIssues, publishIssues } from '../validate';
import { activeBanner, applyStatusAction, effectiveStatus, isPublic } from '../visibility';
import { DEFAULT_CATEGORIES } from '../categories';
import { sampleArticles } from '../sample';
import type { Article } from '../types';

const NOW = new Date('2026-11-02T10:00:00Z');
const body = `<p>${'Fyre reports in its own words. '.repeat(10)}</p>`;
const base: Partial<Article> = { section: 'news', category: 'india', slug: 'a-story', headline: 'A story', description: 'A one-line description that is long enough.', bodyHtml: body, kind: 'report', sources: [], tags: [] };

describe('slugs', () => {
  it('makes readable ASCII slugs', () => {
    expect(slugify('Telangana Assembly passes the Water Bill!')).toBe('telangana-assembly-passes-the-water-bill');
    expect(slugify("India's squad & coach")).toBe('indias-squad-and-coach');
    expect(slugify('తెలంగాణ')).toBe('');
  });
  it('cuts long slugs at a word boundary', () => {
    const s = slugify('word '.repeat(40));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith('-')).toBe(false);
  });
  it('validates and de-duplicates', () => {
    expect(isValidSlug('ok-slug-2')).toBe(true);
    expect(isValidSlug('Bad Slug')).toBe(false);
    expect(uniqueSlug('x', new Set(['x', 'x-2']))).toBe('x-3');
  });
});

describe('editorial rules', () => {
  it('a draft needs only a headline and a category', () => {
    expect(draftIssues(base, DEFAULT_CATEGORIES)).toEqual([]);
    expect(draftIssues({ ...base, headline: '' }, DEFAULT_CATEGORIES).map((i) => i.field)).toContain('headline');
    expect(draftIssues({ ...base, category: 'sports' }, DEFAULT_CATEGORIES).map((i) => i.field)).toContain('category');
  });
  it('politics cannot be published without a source and a fact-checker', () => {
    const p = { ...base, section: 'politics' as const, category: 'telangana' };
    const fields = publishIssues(p, DEFAULT_CATEGORIES).map((i) => i.field);
    expect(fields).toContain('sources');
    expect(fields).toContain('factCheckedBy');
    expect(publishIssues({ ...p, sources: [{ name: 'Gazette', url: 'https://example.gov.in/x', checkedOn: '2026-11-01' }], factCheckedBy: 'Editor' }, DEFAULT_CATEGORIES)).toEqual([]);
  });
  it('an image needs alt text and a credit; opinion needs an author', () => {
    const fields = publishIssues({ ...base, heroImageUrl: 'https://x/y.webp', kind: 'opinion', author: '' }, DEFAULT_CATEGORIES).map((i) => i.field);
    expect(fields).toEqual(expect.arrayContaining(['heroImageAlt', 'imageCredit', 'author']));
  });
  it('short bodies and bad source links are caught', () => {
    expect(publishIssues({ ...base, bodyHtml: '<p>Too short</p>' }, DEFAULT_CATEGORIES).map((i) => i.field)).toContain('bodyHtml');
    expect(draftIssues({ ...base, sources: [{ name: 'X', url: 'not a link', checkedOn: '2026-11-01' }] }, DEFAULT_CATEGORIES).map((i) => i.field)).toContain('sources.0.url');
  });
});

describe('visibility and scheduling', () => {
  it('drafts, unpublished and future-scheduled articles are never public', () => {
    expect(isPublic({ status: 'draft', publishAt: null }, NOW)).toBe(false);
    expect(isPublic({ status: 'unpublished', publishAt: '2026-11-01T00:00:00Z' }, NOW)).toBe(false);
    expect(isPublic({ status: 'scheduled', publishAt: '2026-11-03T00:00:00Z' }, NOW)).toBe(false);
    expect(isPublic({ status: 'scheduled', publishAt: '2026-11-02T09:00:00Z' }, NOW)).toBe(true);
    expect(effectiveStatus({ status: 'scheduled', publishAt: '2026-11-02T09:00:00Z' }, NOW)).toBe('published');
  });
  it('status actions', () => {
    const pub = applyStatusAction({ status: 'draft', publishAt: null, publishedAt: null }, 'publish', NOW);
    expect(pub).toEqual({ status: 'published', publishAt: NOW.toISOString(), publishedAt: NOW.toISOString() });
    expect(() => applyStatusAction({ status: 'draft', publishAt: null, publishedAt: null }, 'schedule', NOW, '2026-11-01T00:00:00Z')).toThrow();
    const un = applyStatusAction(pub, 'unpublish', NOW);
    expect(un.status).toBe('unpublished');
    expect(un.publishedAt).toBe(pub.publishedAt);
  });
  it('one active banner, only inside its time window', () => {
    const b = (id: string, s: string, e: string, active = true) => ({ id, text: id, link: null, startsAt: s, endsAt: e, active, createdBy: null, updatedAt: s });
    expect(activeBanner([b('old', '2026-11-01T00:00:00Z', '2026-11-01T05:00:00Z'), b('now', '2026-11-02T09:00:00Z', '2026-11-02T12:00:00Z'), b('off', '2026-11-02T09:30:00Z', '2026-11-02T12:00:00Z', false)], NOW)?.id).toBe('now');
  });
});

describe('sample content is always marked', () => {
  it('every sample headline says Sample and the body says it is not news', () => {
    for (const a of sampleArticles(NOW)) {
      expect(a.headline.startsWith('Sample:')).toBe(true);
      expect(a.bodyHtml).toContain('It is not news.');
      expect(a.isSample).toBe(true);
    }
  });
});

describe('admin actions on the local file store', () => {
  let dir = '';
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fyre-newsroom-'));
    vi.stubEnv('NEWSROOM_STORE', 'file');
    vi.stubEnv('NEWSROOM_FILE', path.join(dir, 'newsroom.json'));
    vi.stubEnv('NEWSROOM_ENABLED', '1');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates, publishes, unpublishes and restores without deleting anything', async () => {
    const { getNewsroomStore } = await import('../store');
    const { saveDraft, changeStatus, restoreRevision, ValidationError } = await import('../admin');
    const store = await getNewsroomStore();
    const created = await saveDraft(store, { ...base, slug: '', headline: 'Hyderabad Metro Phase 2 explained', bodyHtml: body + '<script>alert(1)</script>' }, 'ed@fyre');
    expect(created.slug).toBe('hyderabad-metro-phase-2-explained');
    expect(created.status).toBe('draft');
    expect(created.bodyHtml).not.toContain('<script>');

    const dup = await saveDraft(store, { ...base, slug: '', headline: 'Hyderabad Metro Phase 2 explained' }, 'ed@fyre');
    expect(dup.slug).toBe('hyderabad-metro-phase-2-explained-2');

    const published = await changeStatus(store, created.id, 'publish', undefined, 'ed@fyre');
    expect(published.status).toBe('published');
    await expect(saveDraft(store, { ...published, description: 'short' }, 'ed@fyre')).rejects.toBeInstanceOf(ValidationError);

    const politics = await saveDraft(store, { ...base, section: 'politics', category: 'telangana', slug: '', headline: 'Cabinet decisions' }, 'ed@fyre');
    await expect(changeStatus(store, politics.id, 'publish', undefined, 'ed@fyre')).rejects.toBeInstanceOf(ValidationError);

    const hidden = await changeStatus(store, created.id, 'unpublish', undefined, 'ed@fyre');
    expect(hidden.status).toBe('unpublished');
    expect(await store.getArticle(created.id)).not.toBeNull();

    const revs = await store.listRevisions(created.id);
    expect(revs.length).toBeGreaterThanOrEqual(3);
    await saveDraft(store, { ...hidden, headline: 'Changed headline' }, 'ed@fyre');
    const first = (await store.listRevisions(created.id)).at(-1)!;
    const restored = await restoreRevision(store, created.id, first.id, 'ed@fyre');
    expect(restored.headline).toBe('Hyderabad Metro Phase 2 explained');
  });
});
