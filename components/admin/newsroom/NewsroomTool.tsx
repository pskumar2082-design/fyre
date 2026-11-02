'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, ImagePlus, Plus, RotateCcw, Trash2 } from 'lucide-react';
import FyreRichTextEditor from '@/components/admin/FyreRichTextEditor';
import type { Article, BreakingBanner, Category, HomeSection, SourceRef } from '@/lib/newsroom/types';
import { KIND_LABEL, SECTION_LABEL, articlePath } from '@/lib/newsroom/categories';
import { slugify } from '@/lib/newsroom/slug';
import { LONG_PASTE_CHARS } from '@/lib/newsroom/validate';
import { adminFetch, isoToIstInput, istInputToIso, resizeImage } from './adminFetch';

type ListItem = Article & { effectiveStatus: Article['status'] };
type Issue = { field: string; message: string };

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-surface2 text-textDim',
  scheduled: 'bg-sky/15 text-sky',
  published: 'bg-goldDim/15 text-goldDim',
  unpublished: 'bg-red/15 text-red'
};

const input = 'w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-textFaint focus:outline-none focus:border-borderStrong';
const label = 'block text-xs font-semibold text-textDim mb-1';
const btn = 'inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-40 disabled:pointer-events-none';
const btnDefault = `${btn} bg-surface2 border-border text-text hover:border-borderStrong`;
const btnPrimary = `${btn} bg-white border-white text-black hover:bg-zinc-200`;

function StatusChip({ s }: { s: string }) {
  return <span className={`inline-block font-mono text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 ${STATUS_STYLE[s] ?? STATUS_STYLE.draft}`}>{s}</span>;
}

function emptyArticle(): Partial<Article> {
  return { section: 'news', category: '', slug: '', headline: '', description: '', bodyHtml: '', heroImageUrl: null, heroImageAlt: '', imageCredit: '', tags: [], sources: [], kind: 'report', author: '', factCheckedBy: '', seoTitle: '', seoDescription: '', correctionNote: '' };
}

export default function NewsroomTool() {
  const [tab, setTab] = useState<'articles' | 'home' | 'categories'>('articles');
  const [editingId, setEditingId] = useState<string | null | 'new'>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [storeKind, setStoreKind] = useState('');

  const loadCategories = useCallback(async () => {
    const s = await adminFetch('/api/admin/newsroom/settings');
    setCategories(s.categories);
    setStoreKind(s.store);
    return s;
  }, []);
  useEffect(() => {
    loadCategories().catch(() => {});
  }, [loadCategories]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex gap-2">
          {(
            [
              ['articles', 'Articles'],
              ['home', 'Homepage and banner'],
              ['categories', 'Categories']
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setEditingId(null); }} className={`${btn} ${tab === k ? 'bg-white text-black border-white' : 'bg-surface border-border text-textDim hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>
        {storeKind === 'file' && <span className="font-mono text-[11px] text-amber">Local file store: changes stay on this computer</span>}
        {storeKind === 'memory' && <span className="font-mono text-[11px] text-amber">Preview sandbox: test data, changes are not saved</span>}
      </div>
      {tab === 'articles' &&
        (editingId ? (
          <ArticleEditor id={editingId === 'new' ? null : editingId} categories={categories} onBack={() => setEditingId(null)} onSaved={(id) => setEditingId(id)} />
        ) : (
          <ArticleList onOpen={(id) => setEditingId(id)} onNew={() => setEditingId('new')} categories={categories} />
        ))}
      {tab === 'home' && <HomePanel />}
      {tab === 'categories' && <CategoriesPanel categories={categories} reload={loadCategories} />}
    </div>
  );
}

function ArticleList({ onOpen, onNew, categories }: { onOpen: (id: string) => void; onNew: () => void; categories: Category[] }) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [status, setStatus] = useState('');
  const [section, setSection] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const sp = new URLSearchParams();
      if (status) sp.set('status', status);
      if (section) sp.set('section', section);
      if (q) sp.set('q', q);
      adminFetch(`/api/admin/newsroom/articles?${sp}`)
        .then((r) => setItems(r.items))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [status, section, q]);

  const catName = (a: Article) => categories.find((c) => c.section === a.section && c.slug === a.category)?.name ?? a.category;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {['', 'draft', 'scheduled', 'published', 'unpublished'].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`${btn} h-8 ${status === s ? 'bg-white text-black border-white' : 'bg-surface border-border text-textDim hover:text-white'}`}>
            {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
        <select value={section} onChange={(e) => setSection(e.target.value)} className={`${input} !w-auto h-9 py-1`}>
          <option value="">News and Politics</option>
          <option value="news">News</option>
          <option value="politics">Politics</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search headlines" className={`${input} !w-48 h-9 py-1`} />
        <button onClick={onNew} className={`${btnPrimary} ml-auto`}>
          <Plus className="w-4 h-4" /> New article
        </button>
      </div>
      {error && <p className="text-red text-sm mb-3">{error}</p>}
      <div className="rounded-xl border border-border divide-y divide-surface2 bg-surface">
        {loading && items.length === 0 ? (
          <p className="p-6 text-sm text-textFaint">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-textFaint">No articles match.</p>
        ) : (
          items.map((a) => (
            <button key={a.id} onClick={() => onOpen(a.id)} className="w-full text-left px-4 py-3 hover:bg-surface2/50 flex items-start gap-3">
              <StatusChip s={a.effectiveStatus} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-text truncate">{a.headline || '(no headline)'}</span>
                <span className="block font-mono text-[11px] text-textFaint truncate">
                  {SECTION_LABEL[a.section]} · {catName(a)} · {KIND_LABEL[a.kind]} · {a.status === 'scheduled' ? `goes live ${new Date(a.publishAt!).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}` : `updated ${new Date(a.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`}
                  {a.featuredRank ? ` · featured #${a.featuredRank}` : ''}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function ArticleEditor({ id, categories, onBack, onSaved }: { id: string | null; categories: Category[]; onBack: () => void; onSaved: (id: string) => void }) {
  const [a, setA] = useState<Partial<Article>>(emptyArticle());
  const [slugTouched, setSlugTouched] = useState(false);
  const [revisions, setRevisions] = useState<{ id: string; editedBy: string | null; editedAt: string; note: string }[]>([]);
  const [checklist, setChecklist] = useState<Issue[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [pasteWarning, setPasteWarning] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [loaded, setLoaded] = useState(!id);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await adminFetch(`/api/admin/newsroom/articles/${id}`);
    setA(r.article);
    setTagsText((r.article.tags ?? []).join(', '));
    setRevisions(r.revisions);
    setChecklist(r.publishIssues);
    setSlugTouched(true);
    setScheduleAt(r.article.status === 'scheduled' ? isoToIstInput(r.article.publishAt) : '');
    setLoaded(true);
  }, [id]);
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [load]);

  const set = <K extends keyof Article>(k: K, v: Article[K]) => setA((x) => ({ ...x, [k]: v }));
  const sectionCats = useMemo(() => categories.filter((c) => c.section === a.section), [categories, a.section]);
  const fieldIssue = (f: string) => issues.find((i) => i.field === f || i.field.startsWith(`${f}.`))?.message;

  async function save(): Promise<string | null> {
    setBusy(true);
    setMessage('');
    setIssues([]);
    try {
      const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
      const r = await adminFetch('/api/admin/newsroom/articles', { method: 'POST', body: JSON.stringify({ article: { ...a, tags, id: a.id } }) });
      setA(r.article);
      setMessage('Saved.');
      if (!id) onSaved(r.article.id);
      else await load();
      return r.article.id;
    } catch (e: any) {
      setIssues(e.issues ?? []);
      setMessage(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string, extra: Record<string, string> = {}) {
    const savedId = await save();
    if (!savedId) return;
    setBusy(true);
    try {
      const r = await adminFetch(`/api/admin/newsroom/articles/${savedId}`, { method: 'POST', body: JSON.stringify({ action, ...extra }) });
      setA(r.article);
      setMessage(action === 'publish' ? 'Published.' : action === 'schedule' ? 'Scheduled.' : action === 'unpublish' ? 'Unpublished: the article is hidden from readers but kept.' : action === 'restore' ? 'Earlier version restored as the current text.' : 'Moved back to draft.');
      await load();
    } catch (e: any) {
      setIssues(e.issues ?? []);
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    setMessage('');
    try {
      const blob = await resizeImage(file);
      const fd = new FormData();
      fd.append('file', blob, file.name.replace(/\.\w+$/, '.webp'));
      const r = await adminFetch('/api/admin/newsroom/upload', { method: 'POST', body: fd });
      set('heroImageUrl', r.url);
      setMessage(`Image uploaded (${Math.round(blob.size / 1024)} KB). Add alt text and a credit.`);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  const sources = (a.sources ?? []) as SourceRef[];
  if (!loaded) return <p className="text-sm text-textFaint">Loading…</p>;
  const live = a.status === 'published' || a.status === 'scheduled';

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={onBack} className={btnDefault}>
          <ArrowLeft className="w-4 h-4" /> All articles
        </button>
        {a.status && <StatusChip s={a.status} />}
        {a.status === 'published' && a.section && a.category && a.slug && (
          <a href={articlePath(a as Article)} target="_blank" rel="noreferrer" className="text-sm text-textDim hover:text-white inline-flex items-center gap-1">
            View live <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {message && <span className={`text-sm ${issues.length ? 'text-red' : 'text-goldDim'}`}>{message}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
        <div className="space-y-4 min-w-0">
          <div>
            <label className={label}>Headline</label>
            <input
              className={`${input} text-lg font-bold`}
              value={a.headline ?? ''}
              maxLength={160}
              onChange={(e) => {
                set('headline', e.target.value);
                if (!slugTouched) set('slug', slugify(e.target.value));
              }}
              placeholder="Write a clear, neutral headline"
            />
            {fieldIssue('headline') && <p className="text-red text-xs mt-1">{fieldIssue('headline')}</p>}
          </div>
          <div>
            <label className={label}>Description (one line, shown on cards and search results)</label>
            <textarea className={input} rows={2} maxLength={300} value={a.description ?? ''} onChange={(e) => set('description', e.target.value)} />
            {fieldIssue('description') && <p className="text-red text-xs mt-1">{fieldIssue('description')}</p>}
          </div>
          <div>
            <label className={label}>URL</label>
            <div className="flex items-center gap-1 text-sm">
              <span className="font-mono text-textFaint whitespace-nowrap">/{a.section}/{a.category || 'category'}/</span>
              <input
                className={`${input} font-mono`}
                value={a.slug ?? ''}
                onChange={(e) => {
                  setSlugTouched(true);
                  set('slug', e.target.value.toLowerCase());
                }}
                placeholder="headline-in-english"
              />
            </div>
            {fieldIssue('slug') && <p className="text-red text-xs mt-1">{fieldIssue('slug')}</p>}
            {live && <p className="text-textFaint text-xs mt-1">Changing the slug of a live article keeps the old link working through a redirect.</p>}
          </div>
          <div
            onPasteCapture={(e) => {
              const text = e.clipboardData.getData('text/plain');
              if (text.length > LONG_PASTE_CHARS) setPasteWarning(true);
            }}
          >
            <label className={label}>Article</label>
            {pasteWarning && (
              <p className="mb-2 rounded-lg border border-amber/60 bg-amber/10 px-3 py-2 text-xs text-text">
                You pasted a long passage. Write Fyre articles in your own words: keep quotes short, attribute them, and list the outlet in Sources.
                <button className="ml-2 underline" onClick={() => setPasteWarning(false)}>
                  OK
                </button>
              </p>
            )}
            <div className="rounded-lg border border-border bg-surface">
              <FyreRichTextEditor value={a.bodyHtml ?? ''} onChange={(html) => set('bodyHtml', html)} />
            </div>
            {fieldIssue('bodyHtml') && <p className="text-red text-xs mt-1">{fieldIssue('bodyHtml')}</p>}
          </div>
          <div>
            <label className={label}>Correction note (shown at the end of the article, dated by you)</label>
            <textarea className={input} rows={2} value={a.correctionNote ?? ''} onChange={(e) => set('correctionNote', e.target.value)} placeholder="Only when correcting a published article" />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>Section</label>
                <select className={input} value={a.section} onChange={(e) => setA((x) => ({ ...x, section: e.target.value as Article['section'], category: '' }))}>
                  <option value="news">News</option>
                  <option value="politics">Politics</option>
                </select>
              </div>
              <div>
                <label className={label}>Type</label>
                <select className={input} value={a.kind} onChange={(e) => set('kind', e.target.value as Article['kind'])}>
                  {Object.entries(KIND_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={label}>Category</label>
              <select className={input} value={a.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Choose…</option>
                {sectionCats.map((c) => (
                  <option key={c.slug} value={c.slug} disabled={!c.active}>
                    {c.name}
                  </option>
                ))}
              </select>
              {fieldIssue('category') && <p className="text-red text-xs mt-1">{fieldIssue('category')}</p>}
            </div>
            <div>
              <label className={label}>Author</label>
              <input className={input} value={a.author ?? ''} onChange={(e) => set('author', e.target.value)} placeholder="Fyre Desk" />
              {fieldIssue('author') && <p className="text-red text-xs mt-1">{fieldIssue('author')}</p>}
            </div>
            <div>
              <label className={label}>Tags (comma separated)</label>
              <input className={input} value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="cricket, hyderabad" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-text">Sources</span>
              <button className={`${btnDefault} h-7 px-2 text-xs`} onClick={() => set('sources', [...sources, { name: '', url: '', checkedOn: new Date().toISOString().slice(0, 10) }])}>
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {sources.length === 0 && <p className="text-xs text-textFaint">List every outlet, document or official source you relied on.</p>}
            {sources.map((s, i) => (
              <div key={i} className="space-y-1.5 border-t border-surface2 pt-2">
                <input className={input} value={s.name} placeholder="Outlet or official body" onChange={(e) => set('sources', sources.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                <input className={input} value={s.url} placeholder="https://..." onChange={(e) => set('sources', sources.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} />
                <div className="flex gap-2">
                  <input type="date" className={input} value={s.checkedOn} onChange={(e) => set('sources', sources.map((x, k) => (k === i ? { ...x, checkedOn: e.target.value } : x)))} />
                  <button aria-label="Remove source" className={`${btnDefault} h-9 px-2`} onClick={() => set('sources', sources.filter((_, k) => k !== i))}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {fieldIssue('sources') && <p className="text-red text-xs">{fieldIssue('sources')}</p>}
            <div>
              <label className={label}>Fact-checked by {a.section === 'politics' && <span className="text-red">(required for Politics)</span>}</label>
              <input className={input} value={a.factCheckedBy ?? ''} onChange={(e) => set('factCheckedBy', e.target.value)} placeholder="Editor's name" />
              {fieldIssue('factCheckedBy') && <p className="text-red text-xs mt-1">{fieldIssue('factCheckedBy')}</p>}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <span className="text-sm font-bold text-text">Image</span>
            {a.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.heroImageUrl} alt={a.heroImageAlt ?? ''} className="w-full aspect-video object-cover rounded-lg border border-border" />
            ) : (
              <p className="text-xs text-textFaint">Use your own photo, a licensed image or an official handout.</p>
            )}
            <label className={`${btnDefault} cursor-pointer w-full`}>
              <ImagePlus className="w-4 h-4" /> {a.heroImageUrl ? 'Replace image' : 'Upload image'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            {a.heroImageUrl && (
              <>
                <input className={input} value={a.heroImageAlt ?? ''} onChange={(e) => set('heroImageAlt', e.target.value)} placeholder="Alt text: what the image shows" />
                <input className={input} value={a.imageCredit ?? ''} onChange={(e) => set('imageCredit', e.target.value)} placeholder="Credit: photographer, agency or handout" />
                <button className="text-xs text-textFaint underline" onClick={() => set('heroImageUrl', null)}>
                  Remove image
                </button>
              </>
            )}
            {(fieldIssue('heroImageAlt') || fieldIssue('imageCredit')) && <p className="text-red text-xs">{fieldIssue('heroImageAlt') ?? fieldIssue('imageCredit')}</p>}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <span className="text-sm font-bold text-text">Search engines</span>
            <input className={input} maxLength={70} value={a.seoTitle ?? ''} onChange={(e) => set('seoTitle', e.target.value)} placeholder="SEO title (optional, defaults to headline)" />
            <textarea className={input} maxLength={160} rows={2} value={a.seoDescription ?? ''} onChange={(e) => set('seoDescription', e.target.value)} placeholder="SEO description (optional)" />
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <span className="text-sm font-bold text-text">Publish</span>
            {checklist.length > 0 && a.status !== 'published' && (
              <ul className="text-xs text-amber space-y-1 list-disc pl-4">
                {checklist.map((i) => (
                  <li key={i.field + i.message}>{i.message}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={save} className={btnDefault}>
                Save draft
              </button>
              <button disabled={busy || !a.id} onClick={() => a.id && window.open(`/admin/preview/${a.id}`, '_blank')} className={btnDefault}>
                Preview
              </button>
              <button disabled={busy} onClick={() => act('publish')} className={btnPrimary}>
                {a.status === 'published' ? 'Update live article' : 'Publish now'}
              </button>
            </div>
            <div>
              <label className={label}>Schedule (IST)</label>
              <div className="flex flex-col gap-2">
                <input type="datetime-local" className={`${input} min-w-0`} value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                <button disabled={busy || !scheduleAt} onClick={() => act('schedule', { at: istInputToIso(scheduleAt) })} className={`${btnDefault} self-start`}>
                  Schedule
                </button>
              </div>
            </div>
            {live && (
              <button disabled={busy} onClick={() => act('unpublish')} className={`${btnDefault} w-full`}>
                Unpublish (hide, keep the article)
              </button>
            )}
            {a.status === 'unpublished' && (
              <button disabled={busy} onClick={() => act('revert_to_draft')} className={`${btnDefault} w-full`}>
                Move back to draft
              </button>
            )}
          </div>

          {revisions.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <span className="text-sm font-bold text-text">History</span>
              <ul className="mt-2 space-y-1.5 max-h-56 overflow-y-auto">
                {revisions.map((r, i) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-textDim min-w-0 truncate">
                      {new Date(r.editedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · {r.note} · {r.editedBy ?? '?'}
                    </span>
                    {i > 0 && (
                      <button title="Restore this version" className="flex-none text-textFaint hover:text-white" onClick={() => act('restore', { revisionId: r.id })}>
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function HomePanel() {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [featured, setFeatured] = useState<{ id: string; headline: string }[]>([]);
  const [published, setPublished] = useState<ListItem[]>([]);
  const [banners, setBanners] = useState<BreakingBanner[]>([]);
  const [banner, setBanner] = useState({ text: '', link: '', startsAt: '', endsAt: '' });
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([adminFetch('/api/admin/newsroom/settings'), adminFetch('/api/admin/newsroom/articles?status=published')]);
    setSections(s.home);
    setFeatured(s.featured);
    setBanners(s.banners);
    setPublished(p.items);
  }, []);
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [load]);

  const move = (i: number, d: number) => setSections((xs) => {
    const ys = [...xs];
    const j = i + d;
    if (j < 0 || j >= ys.length) return xs;
    [ys[i], ys[j]] = [ys[j], ys[i]];
    return ys;
  });

  async function saveHome() {
    try {
      await adminFetch('/api/admin/newsroom/settings', { method: 'POST', body: JSON.stringify({ type: 'home', sections, featuredIds: featured.map((f) => f.id) }) });
      setMessage('Homepage saved.');
    } catch (e: any) {
      setMessage(e.message);
    }
  }
  async function saveBanner(b: Partial<BreakingBanner> & { text: string }) {
    try {
      await adminFetch('/api/admin/newsroom/settings', { method: 'POST', body: JSON.stringify({ type: 'banner', banner: b }) });
      setMessage('Banner saved.');
      setBanner({ text: '', link: '', startsAt: '', endsAt: '' });
      await load();
    } catch (e: any) {
      setMessage(e.message);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {message && <p className="lg:col-span-2 text-sm text-goldDim">{message}</p>}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="font-bold text-text mb-3">Homepage sections</h3>
        <ul className="space-y-2">
          {sections.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2">
              <input type="checkbox" checked={s.enabled} onChange={(e) => setSections((xs) => xs.map((x) => (x.key === s.key ? { ...x, enabled: e.target.checked } : x)))} />
              <span className="flex-1 text-sm text-text">{s.label}</span>
              <button aria-label="Move up" className="text-textFaint hover:text-white" onClick={() => move(i, -1)}>
                <ArrowUp className="w-4 h-4" />
              </button>
              <button aria-label="Move down" className="text-textFaint hover:text-white" onClick={() => move(i, 1)}>
                <ArrowDown className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
        <h3 className="font-bold text-text mt-5 mb-2">Featured stories (up to 5, in order)</h3>
        <ol className="space-y-1.5 mb-3">
          {featured.map((f, i) => (
            <li key={f.id} className="flex items-center gap-2 text-sm">
              <span className="font-mono text-textFaint w-4">{i + 1}</span>
              <span className="flex-1 truncate text-text">{f.headline}</span>
              <button aria-label="Remove" className="text-textFaint hover:text-white" onClick={() => setFeatured((xs) => xs.filter((x) => x.id !== f.id))}>
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ol>
        {featured.length < 5 && (
          <select className={input} value="" onChange={(e) => {
            const p = published.find((x) => x.id === e.target.value);
            if (p) setFeatured((xs) => [...xs, { id: p.id, headline: p.headline }]);
          }}>
            <option value="">Add a published story…</option>
            {published.filter((p) => !featured.some((f) => f.id === p.id)).map((p) => (
              <option key={p.id} value={p.id}>
                {p.headline}
              </option>
            ))}
          </select>
        )}
        <button onClick={saveHome} className={`${btnPrimary} mt-4`}>
          Save homepage
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="font-bold text-text mb-3">Breaking-news banner</h3>
        <div className="space-y-2">
          <input className={input} maxLength={140} value={banner.text} onChange={(e) => setBanner({ ...banner, text: e.target.value })} placeholder="Banner text (up to 140 characters)" />
          <input className={input} value={banner.link} onChange={(e) => setBanner({ ...banner, link: e.target.value })} placeholder="Link: /news/breaking/... or https://..." />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>Starts (IST, blank = now)</label>
              <input type="datetime-local" className={input} value={banner.startsAt} onChange={(e) => setBanner({ ...banner, startsAt: e.target.value })} />
            </div>
            <div>
              <label className={label}>Ends (IST)</label>
              <input type="datetime-local" className={input} value={banner.endsAt} onChange={(e) => setBanner({ ...banner, endsAt: e.target.value })} />
            </div>
          </div>
          <button
            className={btnPrimary}
            disabled={!banner.text || !banner.endsAt}
            onClick={() => saveBanner({ text: banner.text, link: banner.link, startsAt: banner.startsAt ? istInputToIso(banner.startsAt) : new Date().toISOString(), endsAt: istInputToIso(banner.endsAt), active: true })}
          >
            Show banner
          </button>
          <p className="text-xs text-textFaint">One banner shows at a time. It switches itself off at the end time.</p>
        </div>
        <ul className="mt-4 divide-y divide-surface2">
          {banners.slice(0, 6).map((b) => {
            const on = b.active && Date.parse(b.endsAt) > Date.now();
            return (
              <li key={b.id} className="py-2 flex items-center gap-2 text-sm">
                <StatusChip s={on ? 'published' : 'draft'} />
                <span className="flex-1 min-w-0 truncate text-text">{b.text}</span>
                {on && (
                  <button className="text-xs text-textFaint underline" onClick={() => saveBanner({ ...b, active: false })}>
                    Turn off
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function CategoriesPanel({ categories, reload }: { categories: Category[]; reload: () => Promise<unknown> }) {
  const [draft, setDraft] = useState<Category>({ section: 'news', slug: '', name: '', description: '', sort: 99, active: true });
  const [message, setMessage] = useState('');
  async function save(c: Category) {
    try {
      await adminFetch('/api/admin/newsroom/settings', { method: 'POST', body: JSON.stringify({ type: 'category', category: c }) });
      setMessage(`Saved "${c.name}".`);
      await reload();
    } catch (e: any) {
      setMessage(e.message);
    }
  }
  return (
    <div className="space-y-5">
      {message && <p className="text-sm text-goldDim">{message}</p>}
      {(['news', 'politics'] as const).map((section) => (
        <div key={section} className="rounded-xl border border-border bg-surface p-4">
          <h3 className="font-bold text-text mb-3">{SECTION_LABEL[section]}</h3>
          <div className="space-y-2">
            {categories.filter((c) => c.section === section).map((c) => (
              <CategoryRow key={c.slug} c={c} onSave={save} />
            ))}
          </div>
        </div>
      ))}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="font-bold text-text mb-3">Add a category</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <select className={input} value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value as Category['section'] })}>
            <option value="news">News</option>
            <option value="politics">Politics</option>
          </select>
          <input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: slugify(e.target.value) })} placeholder="Name" />
          <input className={`${input} font-mono`} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="url-slug" />
          <button className={btnPrimary} onClick={() => save(draft)} disabled={!draft.name || !draft.slug}>
            Add
          </button>
        </div>
        <p className="text-xs text-textFaint mt-2">A category&apos;s URL slug is fixed once articles use it. You can rename or hide a category at any time.</p>
      </div>
    </div>
  );
}

function CategoryRow({ c, onSave }: { c: Category; onSave: (c: Category) => void }) {
  const [v, setV] = useState(c);
  const dirty = JSON.stringify(v) !== JSON.stringify(c);
  return (
    <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[180px_1fr_70px_auto_auto] gap-2 items-center">
      <input className={input} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      <span className="font-mono text-xs text-textFaint sm:hidden">/{c.section}/{c.slug}</span>
      <input className={`${input} hidden sm:block`} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Description" />
      <input className={`${input} hidden sm:block`} type="number" value={v.sort} onChange={(e) => setV({ ...v, sort: Number(e.target.value) })} />
      <label className="flex items-center gap-1.5 text-xs text-textDim">
        <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Shown
      </label>
      <button className={btnDefault} disabled={!dirty} onClick={() => onSave(v)}>
        Save
      </button>
    </div>
  );
}
