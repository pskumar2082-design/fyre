import fs from 'fs';
import path from 'path';
import type { Article, BreakingBanner, Category, HomeSection, Revision } from './types';
import { DEFAULT_HOME_SECTIONS } from './types';
import { DEFAULT_CATEGORIES } from './categories';
import type { ArticleQuery, NewsroomStore } from './store';
import { newId } from './store';
import { isPublic } from './visibility';
import { sampleArticles } from './sample';

// LOCAL DEVELOPMENT ONLY. Keeps the newsroom in .data/newsroom.json so the
// admin and public pages can be built and tested without touching any
// database. Refused on Vercel (see store.ts). Seeded with clearly marked
// sample articles on first use.

type Db = {
  categories: Category[];
  articles: Article[];
  revisions: Revision[];
  banners: BreakingBanner[];
  home: HomeSection[];
  views: Record<string, Record<string, number>>;
};

function file(): string {
  return process.env.NEWSROOM_FILE ?? path.join(process.cwd(), '.data', 'newsroom.json');
}

// Preview sandbox (NEWSROOM_STORE=memory): the same sample newsroom, held in
// this server instance's memory instead of a file. Nothing is written to
// disk or to any database; edits disappear when the instance restarts.
const memoryMode = () => process.env.NEWSROOM_STORE === 'memory';
const g = globalThis as unknown as { __fyreNewsroomMemory?: Db };

function seed(now: Date): Db {
  return {
    categories: DEFAULT_CATEGORIES,
    articles: sampleArticles(now),
    revisions: [],
    banners: [
      {
        id: newId(),
        text: 'Sample banner: breaking-news text set by an editor, with an end time',
        link: '/news/breaking',
        startsAt: new Date(now.getTime() - 3_600_000).toISOString(),
        endsAt: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
        active: true,
        createdBy: 'sample',
        updatedAt: now.toISOString()
      }
    ],
    home: DEFAULT_HOME_SECTIONS,
    views: {}
  };
}

function load(): Db {
  if (memoryMode()) {
    if (!g.__fyreNewsroomMemory) g.__fyreNewsroomMemory = seed(new Date());
    return g.__fyreNewsroomMemory;
  }
  const f = file();
  if (!fs.existsSync(f)) {
    const db = seed(new Date());
    save(db);
    return db;
  }
  return JSON.parse(fs.readFileSync(f, 'utf8')) as Db;
}

function save(db: Db) {
  if (memoryMode()) {
    g.__fyreNewsroomMemory = db;
    return;
  }
  const f = file();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, f);
}

function matches(a: Article, q: ArticleQuery): boolean {
  if (q.section && a.section !== q.section) return false;
  if (q.category && a.category !== q.category) return false;
  if (q.statuses && !q.statuses.includes(a.status)) return false;
  if (q.publicAt && !isPublic(a, q.publicAt)) return false;
  if (q.tag && !a.tags.map((t) => t.toLowerCase()).includes(q.tag.toLowerCase())) return false;
  if (q.featuredOnly && a.featuredRank == null) return false;
  if (q.search) {
    const s = q.search.toLowerCase();
    if (!`${a.headline} ${a.description} ${a.tags.join(' ')}`.toLowerCase().includes(s)) return false;
  }
  return true;
}

function sortKey(a: Article): number {
  return Date.parse(a.publishAt ?? a.updatedAt);
}

export function fileStore(): NewsroomStore {
  return {
    kind: 'file',
    async listCategories() {
      return load().categories.sort((a, b) => a.section.localeCompare(b.section) || a.sort - b.sort);
    },
    async saveCategory(c) {
      const db = load();
      const i = db.categories.findIndex((x) => x.section === c.section && x.slug === c.slug);
      if (i >= 0) db.categories[i] = c;
      else db.categories.push(c);
      save(db);
      return c;
    },
    async listArticles(q) {
      const all = load().articles.filter((a) => matches(a, q));
      all.sort((a, b) => (q.featuredOnly ? (a.featuredRank ?? 99) - (b.featuredRank ?? 99) : sortKey(b) - sortKey(a)));
      const offset = q.offset ?? 0;
      return { items: all.slice(offset, offset + (q.limit ?? 50)), total: all.length };
    },
    async getArticle(id) {
      return load().articles.find((a) => a.id === id) ?? null;
    },
    async getBySlug(section, slug) {
      return load().articles.find((a) => a.section === section && a.slug === slug) ?? null;
    },
    async slugTaken(section, slug, exceptId) {
      return load().articles.some((a) => a.section === section && a.slug === slug && a.id !== exceptId);
    },
    async saveArticle(input, editor, note) {
      const db = load();
      const now = new Date().toISOString();
      const existing = input.id ? db.articles.find((a) => a.id === input.id) : undefined;
      const article: Article = existing
        ? { ...existing, ...input, id: existing.id, status: existing.status, publishAt: existing.publishAt, publishedAt: existing.publishedAt, createdAt: existing.createdAt, updatedAt: now }
        : { ...input, id: newId(), status: 'draft', publishAt: null, publishedAt: null, createdAt: now, updatedAt: now };
      if (existing) db.articles[db.articles.indexOf(existing)] = article;
      else db.articles.push(article);
      db.revisions.push({ id: newId(), articleId: article.id, editedBy: editor, editedAt: now, note, snapshot: article });
      save(db);
      return article;
    },
    async setStatus(id, fields, editor, note) {
      const db = load();
      const a = db.articles.find((x) => x.id === id);
      if (!a) throw new Error('Article not found');
      Object.assign(a, fields, { updatedAt: new Date().toISOString() });
      db.revisions.push({ id: newId(), articleId: id, editedBy: editor, editedAt: a.updatedAt, note, snapshot: a });
      save(db);
      return a;
    },
    async listRevisions(id) {
      return load()
        .revisions.filter((r) => r.articleId === id)
        .sort((a, b) => Date.parse(b.editedAt) - Date.parse(a.editedAt));
    },
    async setFeatured(orderedIds) {
      const db = load();
      for (const a of db.articles) {
        const i = orderedIds.indexOf(a.id);
        a.featuredRank = i >= 0 && i < 5 ? i + 1 : null;
      }
      save(db);
    },
    async listBanners() {
      return load().banners.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
    },
    async saveBanner(b, editor) {
      const db = load();
      const now = new Date().toISOString();
      if (b.active) for (const x of db.banners) if (x.id !== b.id) x.active = false; // one active banner at a time
      const existing = b.id ? db.banners.find((x) => x.id === b.id) : undefined;
      const banner: BreakingBanner = { ...(existing ?? { id: newId(), createdBy: editor }), ...b, id: existing?.id ?? newId(), createdBy: existing?.createdBy ?? editor, updatedAt: now } as BreakingBanner;
      if (existing) db.banners[db.banners.indexOf(existing)] = banner;
      else db.banners.push(banner);
      save(db);
      return banner;
    },
    async getHomeSections() {
      return load().home.sort((a, b) => a.sort - b.sort);
    },
    async saveHomeSections(s) {
      const db = load();
      db.home = s.map((x, i) => ({ ...x, sort: i + 1 }));
      save(db);
      return db.home;
    },
    async recordView(articleId, day) {
      const db = load();
      db.views[articleId] = db.views[articleId] ?? {};
      db.views[articleId][day] = (db.views[articleId][day] ?? 0) + 1;
      save(db);
    },
    async viewsSince(day) {
      const db = load();
      return Object.entries(db.views).map(([articleId, days]) => ({ articleId, views: Object.entries(days).filter(([d]) => d >= day).reduce((s, [, n]) => s + n, 0) }));
    }
  };
}

export function memoryStore(): NewsroomStore {
  return { ...fileStore(), kind: 'memory' };
}
