'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, Download, Loader2, RotateCcw, Sparkles, Type } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui';
import MovieSelector from '@/components/compare/MovieSelector';
import { useMovieCatalog } from '@/lib/compare/useMovieCatalog';
import type { TTListedMovie } from '@/lib/boxoffice/types';
import {
  buildCaption,
  CATEGORY,
  cleanPostText,
  CONTENT_LABEL,
  CONTENT_TYPES,
  extractNumbers,
  rewriteForFyre,
  sameAsReported,
  TEMPLATE_LABEL,
  templateFor,
  type ContentType,
  type ImportedPost,
  type ReportedNumber,
  type TemplateId
} from '@/lib/social/xPost';
import { CARD_SIZES, DEFAULT_SIZE, type SizeId } from '@/lib/poster/cardSizes';
import type { ImageLayout } from '@/lib/poster/socialCard';
import type { FyreFigures, FyreSelection } from '@/lib/social/fyreData';

// Admin → Social poster → X Post Designer.
//   paste an X post URL → import (text, author, date, media) → edit every
//   word → Fyre picks a template (overridable) → live preview at the real
//   output size → download + copy caption. Nothing is published from here.
// The preview IS the final render (same server route, same size).

type Img = { url: string; width: number; height: number; thumb: string | null; type: string; selected: boolean; fit: 'fill' | 'fit'; zoom: number; posX: number; posY: number };
type Fields = { category: string; headline: string; subhead: string; body: string; movie: string; highlight: string; fact: string; hashtags: string; footer: string };
type Imported = {
  importId: number | null;
  post: ImportedPost;
  thumbs: (string | null)[];
  movie: { slug: string; title: string; reason: string } | null;
  movieName: string | null;
  type: ContentType;
  template: TemplateId;
  numbers: ReportedNumber[];
  selection: { kind: 'day'; day: number } | { kind: 'cumulative'; days: number | null } | null;
  copy: { headline: string; subhead: string; body: string; caption: string; hashtags: string };
  warnings: string[];
};

const FOOTER = '@Fyre_media_';
const LAYOUTS: { id: ImageLayout; label: string; n: number }[] = [
  { id: 'single', label: 'Single hero', n: 1 },
  { id: 'split', label: '2-image split', n: 2 },
  { id: 'grid3', label: '3-image grid', n: 3 },
  { id: 'grid4', label: '4-image grid', n: 4 }
];

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

const input = 'w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-gold/50';
const label = 'block text-[11px] font-semibold uppercase tracking-wider text-textFaint mb-1';
const pill = (on: boolean) => `text-xs font-semibold px-3 py-1.5 rounded-full border transition ${on ? 'bg-gold/[0.12] border-gold/40 text-gold' : 'border-border text-textDim hover:text-text'}`;

function defaultsFrom(imp: Imported): Fields {
  return {
    category: CATEGORY[imp.type],
    headline: imp.copy.headline,
    subhead: imp.copy.subhead,
    body: imp.copy.body,
    movie: imp.movie?.title ?? imp.movieName ?? '',
    highlight: '',
    fact: '',
    hashtags: imp.copy.hashtags,
    footer: FOOTER
  };
}

function imagesFrom(imp: Imported, template: TemplateId): Img[] {
  return imp.post.media.slice(0, 4).map((m, i) => ({
    url: m.url,
    width: m.width,
    height: m.height,
    thumb: imp.thumbs[i] ?? null,
    type: m.type,
    selected: i === 0,
    // A poster on an image-first card is shown whole by default.
    fit: template === 'imageFirst' ? 'fit' : 'fill',
    zoom: 1,
    posX: 50,
    posY: m.height > m.width ? 30 : 50
  }));
}

export default function XPostDesigner() {
  const catalog = useMovieCatalog();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imp, setImp] = useState<Imported | null>(null);
  const [text, setText] = useState(''); // the imported post text (editable input)
  const [author, setAuthor] = useState({ name: '', handle: '' });
  const [f, setF] = useState<Fields>({ category: 'MOVIE UPDATE', headline: '', subhead: '', body: '', movie: '', highlight: '', fact: '', hashtags: '', footer: FOOTER });
  const [contentType, setContentType] = useState<'auto' | ContentType>('auto');
  const [templateSel, setTemplateSel] = useState<'auto' | TemplateId>('auto');
  const [size, setSize] = useState<SizeId>(DEFAULT_SIZE);
  const [accent, setAccent] = useState<'fyre' | 'gold'>('fyre');
  const [heroMode, setHeroMode] = useState<'framed' | 'full'>('framed');
  const [imgs, setImgs] = useState<Img[]>([]);
  const [hero, setHero] = useState(0);
  const [layout, setLayout] = useState<ImageLayout>('single');
  const [caption, setCaption] = useState('');
  const [captionEdited, setCaptionEdited] = useState(false);
  const [copied, setCopied] = useState(false);

  // Box office
  const [boMovie, setBoMovie] = useState<TTListedMovie | null>(null);
  const [territory, setTerritory] = useState<'IN' | 'US'>('IN');
  const [selKind, setSelKind] = useState<'day' | 'first' | 'lifetime'>('day');
  const [selN, setSelN] = useState(1);
  const [fyre, setFyre] = useState<FyreFigures | null>(null);
  const [fyreErr, setFyreErr] = useState<string | null>(null);
  const [reportedIdx, setReportedIdx] = useState(0);
  const [numberMode, setNumberMode] = useState<'fyre' | 'source' | 'none' | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [useFyrePoster, setUseFyrePoster] = useState(false);

  // Preview
  const [preview, setPreview] = useState<{ url: string; w: number; h: number; removed: string } | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderErr, setRenderErr] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const reported = useMemo(() => extractNumbers(text), [text]);
  const suggestedType = imp?.type ?? 'general';
  const type: ContentType = contentType === 'auto' ? suggestedType : contentType;
  const selectedImgs = useMemo(() => {
    const sel = imgs.map((im, i) => ({ im, i })).filter((x) => x.im.selected);
    const h = sel.find((x) => x.i === hero);
    return h ? [h.im, ...sel.filter((x) => x.i !== hero).map((x) => x.im)] : sel.map((x) => x.im);
  }, [imgs, hero]);
  const template: TemplateId = templateSel === 'auto' ? templateFor(type, selectedImgs.length + (useFyrePoster ? 1 : 0), text.length) : templateSel;
  const chosenNumber: ReportedNumber | null = reported[reportedIdx] ?? null;
  const conflict = fyre && chosenNumber ? !sameAsReported(chosenNumber, fyre.gross, fyre.currency) : false;

  // ------------------------------------------------------------------ import
  async function doImport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/x-post', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ action: 'import', url }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      applyImport(j as Imported);
    } catch (err: any) {
      setError(err?.message ?? 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  function applyImport(j: Imported) {
    setImp(j);
    setText(j.post.text);
    setAuthor({ name: j.post.authorName, handle: j.post.handle });
    setF(defaultsFrom(j));
    setContentType('auto');
    setTemplateSel('auto');
    setHeroMode('framed');
    setImgs(imagesFrom(j, j.template));
    setHero(0);
    setLayout('single');
    setCaptionEdited(false);
    setFyre(null);
    setFyreErr(null);
    setReportedIdx(0);
    setNumberMode(j.numbers.length ? 'source' : null);
    setSourceLabel(j.selection?.kind === 'day' ? (j.selection.day === 1 ? 'OPENING DAY' : `DAY ${j.selection.day}`) : j.selection?.kind === 'cumulative' ? (j.selection.days ? `${j.selection.days} DAYS` : 'TOTAL') : 'BOX OFFICE');
    setSelKind(j.selection?.kind === 'cumulative' ? (j.selection.days ? 'first' : 'lifetime') : 'day');
    setSelN(j.selection?.kind === 'day' ? j.selection.day : j.selection?.kind === 'cumulative' && j.selection.days ? j.selection.days : 1);
    setUseFyrePoster(false);
  }

  // Default movie for "Use Fyre data": the one detected in the post.
  useEffect(() => {
    if (!imp?.movie || boMovie) return;
    const m = catalog.movies.find((x) => x.slug === imp.movie!.slug);
    if (m) setBoMovie(m);
  }, [imp, catalog.movies, boMovie]);

  // ------------------------------------------------------------- copy tools
  function useOriginal() {
    if (!imp) return;
    const clean = cleanPostText({ text, mentions: imp.post.mentions });
    const [first, ...rest] = clean.split(/\n+/);
    setF((x) => ({ ...x, headline: first ?? '', subhead: '', body: rest.join(' ') }));
    setCaptionEdited(false);
  }
  function rewrite() {
    if (!imp) return;
    const c = rewriteForFyre({ text, mentions: imp.post.mentions, hashtags: imp.post.hashtags }, { movie: f.movie || null, type });
    setF((x) => ({ ...x, headline: c.headline, subhead: c.subhead, body: c.body, hashtags: c.hashtags }));
    setCaption(c.caption);
    setCaptionEdited(false);
  }
  function reset() {
    if (imp) applyImport(imp);
  }

  // An image-first card shows a poster whole by default (nothing cropped);
  // other templates fill their image boxes. Only on a template change, so
  // the admin's own Fit choice afterwards is kept.
  const lastTemplate = useRef<TemplateId | null>(null);
  useEffect(() => {
    if (lastTemplate.current && lastTemplate.current !== template) {
      const fit = template === 'imageFirst' ? 'fit' : 'fill';
      setImgs((xs) => xs.map((x) => ({ ...x, fit })));
    }
    lastTemplate.current = template;
  }, [template]);

  // Category follows the content type unless edited.
  const lastType = useRef<ContentType | null>(null);
  useEffect(() => {
    if (lastType.current && lastType.current !== type) setF((x) => ({ ...x, category: CATEGORY[type] }));
    lastType.current = type;
  }, [type]);

  useEffect(() => {
    if (!captionEdited) setCaption(buildCaption(f));
  }, [f, captionEdited]);

  // -------------------------------------------------------------- Fyre data
  async function loadFyre() {
    if (!boMovie) return setFyreErr('Choose the Fyre movie first');
    setFyreErr(null);
    const selection: FyreSelection = selKind === 'day' ? { kind: 'day', day: selN } : selKind === 'first' ? { kind: 'first', days: selN } : { kind: 'lifetime' };
    const res = await fetch('/api/admin/x-post', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ action: 'fyreData', slug: boMovie.slug, territory, selection }) });
    const j = await res.json();
    if (!res.ok || j.error) {
      setFyre(null);
      return setFyreErr(j.error ?? 'Fyre data unavailable');
    }
    setFyre(j);
    // Matching numbers: use Fyre's. Different: the admin must choose.
    const c = reported[reportedIdx];
    setNumberMode(!c || sameAsReported(c, j.gross, j.currency) ? 'fyre' : null);
  }

  // Post text that still carries a different figure next to Fyre's data.
  const strayFigures = useMemo(() => {
    if (numberMode !== 'fyre' || !fyre) return [];
    return extractNumbers([f.headline, f.subhead, f.body, f.fact].join('\n')).filter((n) => !sameAsReported(n, fyre.gross, fyre.currency));
  }, [numberMode, fyre, f]);

  // ---------------------------------------------------------------- render
  const spec = useMemo(() => {
    const images = [
      ...(useFyrePoster && boMovie ? [{ source: 'fyre', slug: boMovie.slug, fit: 'fill', zoom: 1, posX: 50, posY: 50 }] : []),
      ...selectedImgs.map((im) => ({ source: 'x', url: im.url, width: im.width, height: im.height, fit: im.fit, zoom: im.zoom, posX: im.posX, posY: im.posY }))
    ].slice(0, 4);
    const numbers =
      template !== 'boxoffice' || !numberMode || numberMode === 'none'
        ? null
        : numberMode === 'fyre' && fyre && boMovie
          ? { mode: 'fyre', fyre: { slug: boMovie.slug, territory, selection: selKind === 'day' ? { kind: 'day', day: selN } : selKind === 'first' ? { kind: 'first', days: selN } : { kind: 'lifetime' } } }
          : numberMode === 'source' && chosenNumber
            ? { mode: 'source', label: sourceLabel, value: chosenNumber.raw }
            : null;
    return { template, size, accent, heroMode, imageLayout: layout, ...f, images, numbers, watermark: true };
  }, [template, size, accent, heroMode, layout, f, selectedImgs, useFyrePoster, boMovie, numberMode, fyre, territory, selKind, selN, chosenNumber, sourceLabel]);

  const specKey = JSON.stringify(spec);
  useEffect(() => {
    if (!imp) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setRendering(true);
      setRenderErr(null);
      try {
        const res = await fetch('/api/admin/x-post/render', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: specKey, signal: ctrl.signal });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        blobRef.current = blob;
        setPreview((p) => {
          if (p) URL.revokeObjectURL(p.url);
          return { url: URL.createObjectURL(blob), w: Number(res.headers.get('X-Card-Width')), h: Number(res.headers.get('X-Card-Height')), removed: decodeURIComponent(res.headers.get('X-Card-Removed') ?? '') };
        });
      } catch (err: any) {
        if (err?.name !== 'AbortError') setRenderErr(err?.message ?? 'Render failed');
      } finally {
        if (!ctrl.signal.aborted) setRendering(false);
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [specKey, imp]);

  function download() {
    if (!blobRef.current || !preview) return;
    const a = document.createElement('a');
    a.href = preview.url;
    const slug = (f.movie || f.headline || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    a.download = `fyre-${slug}-${template}-${preview.w}x${preview.h}.png`;
    a.click();
  }
  async function copyCaption() {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const setImg = useCallback((i: number, patch: Partial<Img>) => setImgs((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x))), []);
  const field = (k: keyof Fields, lbl: string, rows = 0, hint?: string) => (
    <label className="block">
      <span className={label}>{lbl}</span>
      {rows ? (
        <textarea className={input} rows={rows} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} />
      ) : (
        <input className={input} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} />
      )}
      {hint && <span className="text-[11px] text-textFaint">{hint}</span>}
    </label>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_460px] items-start">
      {/* ------------------------------------------------------------ LEFT */}
      <div className="grid gap-5 min-w-0">
        <Card className="p-4">
          <span className={label}>X post URL</span>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              doImport();
            }}
          >
            <input className={input} placeholder="https://x.com/account/status/1234567890" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button type="submit" disabled={busy || !url.trim()} className="text-sm font-semibold bg-gold text-white rounded-lg px-4 disabled:opacity-40 inline-flex items-center gap-1.5">
              {busy && <Loader2 size={14} className="animate-spin" />} Import
            </button>
          </form>
          <p className="text-[11px] text-textFaint mt-2">One post at a time (x.com or twitter.com …/status/…). Nothing is published from here.</p>
          {error && <div className="text-red text-sm mt-2">{error}</div>}
          {imp?.warnings.map((w) => (
            <div key={w} className="text-amber text-xs mt-1">
              {w}
            </div>
          ))}
        </Card>

        {imp && (
          <>
            <Card className="p-4 grid gap-3">
              <div className="mdtype-overline text-gold">Imported post · input, not final copy</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label>
                  <span className={label}>Author name</span>
                  <input className={input} value={author.name} onChange={(e) => setAuthor((a) => ({ ...a, name: e.target.value }))} />
                </label>
                <label>
                  <span className={label}>Handle</span>
                  <input className={input} value={author.handle} onChange={(e) => setAuthor((a) => ({ ...a, handle: e.target.value }))} />
                </label>
              </div>
              <label>
                <span className={label}>Post text</span>
                <textarea className={input} rows={6} value={text} onChange={(e) => setText(e.target.value)} />
              </label>
              <div className="text-[11px] text-textDim grid gap-0.5">
                {imp.post.postedAt && <div>Posted: {new Date(imp.post.postedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>}
                {imp.post.hashtags.length > 0 && <div>Hashtags: {imp.post.hashtags.map((h) => `#${h}`).join(' ')}</div>}
                <div>Movie: {imp.movie ? `${imp.movie.title} (Fyre · ${imp.movie.reason})` : imp.movieName ? `${imp.movieName} (from hashtag — not a Fyre movie)` : 'not detected'}</div>
                {imp.post.links.length > 0 && <div className="break-all">Links: {imp.post.links.join(' · ')}</div>}
                {reported.length > 0 && <div>Figures in the post: {reported.map((n) => n.raw).join(', ')}</div>}
                <div className="text-textFaint">Source kept for traceability (not printed): {imp.post.url}</div>
              </div>

              {imgs.length > 0 && (
                <div>
                  <span className={label}>Media</span>
                  <div className="flex flex-wrap gap-3">
                    {imgs.map((im, i) => (
                      <div key={im.url} className={`w-[118px] rounded-lg border p-1.5 ${im.selected ? 'border-gold/60' : 'border-border'}`}>
                        <div className="aspect-square bg-surface2 rounded overflow-hidden flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {im.thumb ? <img src={im.thumb} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] text-textFaint">no preview</span>}
                        </div>
                        <label className="flex items-center gap-1.5 text-[11px] mt-1.5">
                          <input type="checkbox" checked={im.selected} onChange={(e) => setImg(i, { selected: e.target.checked })} /> Image {i + 1}
                          {im.type !== 'photo' ? ' (video frame)' : ''}
                        </label>
                        <label className="flex items-center gap-1.5 text-[11px]">
                          <input type="radio" name="hero" checked={hero === i} onChange={() => (setHero(i), setImg(i, { selected: true }))} /> Hero
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-textFaint mt-1">Check another outlet’s branding before using its images.</p>
                </div>
              )}
            </Card>

            <Card className="p-4 grid gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[180px]">
                  <span className={label}>Content type</span>
                  <select className={input} value={contentType} onChange={(e) => setContentType(e.target.value as any)}>
                    <option value="auto">Auto ({CONTENT_LABEL[suggestedType]})</option>
                    {CONTENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {CONTENT_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-[220px]">
                  <span className={label}>Template</span>
                  <select className={input} value={templateSel} onChange={(e) => setTemplateSel(e.target.value as any)}>
                    <option value="auto">Auto ({TEMPLATE_LABEL[templateFor(type, selectedImgs.length, text.length)]})</option>
                    {(Object.keys(TEMPLATE_LABEL) as TemplateId[]).map((t) => (
                      <option key={t} value={t}>
                        {TEMPLATE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(CARD_SIZES) as SizeId[]).map((s) => (
                  <button key={s} type="button" className={pill(size === s)} onClick={() => setSize(s)}>
                    {CARD_SIZES[s].label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] text-textFaint mr-1">Accent</span>
                <button type="button" className={pill(accent === 'fyre')} onClick={() => setAccent('fyre')}>
                  Fyre blue
                </button>
                <button type="button" className={pill(accent === 'gold')} onClick={() => setAccent('gold')}>
                  Gold
                </button>
                {template === 'imageFirst' && (
                  <>
                    <span className="text-[11px] text-textFaint ml-3 mr-1">Hero</span>
                    <button type="button" className={pill(heroMode === 'framed')} onClick={() => setHeroMode('framed')}>
                      Framed (nothing covered)
                    </button>
                    <button type="button" className={pill(heroMode === 'full')} onClick={() => setHeroMode('full')}>
                      Full-bleed
                    </button>
                  </>
                )}
              </div>
            </Card>

            <Card className="p-4 grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mdtype-overline text-gold mr-auto">Poster copy</div>
                <button type="button" className={pill(false)} onClick={useOriginal}>
                  <Type size={12} className="inline mr-1" />
                  Use Original Text
                </button>
                <button type="button" className={pill(false)} onClick={rewrite}>
                  <Sparkles size={12} className="inline mr-1" />
                  Rewrite for Fyre
                </button>
                <button type="button" className={pill(false)} onClick={reset}>
                  <RotateCcw size={12} className="inline mr-1" />
                  Reset
                </button>
              </div>
              <p className="text-[11px] text-textFaint -mt-1">Rewrite only reorders and trims the post’s own words — it never adds facts or figures.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {field('category', 'Category')}
                {field('movie', 'Movie name')}
              </div>
              {field('headline', 'Headline', 2)}
              {field('subhead', 'Subheadline', 2)}
              {field('body', 'Body', 3)}
              <div className="grid sm:grid-cols-2 gap-3">
                {field('highlight', 'Highlighted phrase', 0, 'Words from the headline to show in the accent colour')}
                {field('fact', 'Highlighted quote / fact', 0, 'Optional callout (template A)')}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {field('hashtags', 'Hashtags')}
                {field('footer', 'Footer')}
              </div>
            </Card>

            {(template === 'boxoffice' || reported.length > 0) && (
              <Card className="p-4 grid gap-3">
                <div className="mdtype-overline text-gold">Box office figures</div>
                {reported.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-[11px] text-textFaint">Figure in the post:</span>
                    {reported.map((n, i) => (
                      <button key={i} type="button" className={pill(reportedIdx === i)} onClick={() => setReportedIdx(i)}>
                        {n.raw}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
                  <MovieSelector movies={catalog.movies} loading={catalog.loading} error={catalog.error} selected={boMovie} onSelect={setBoMovie} onClear={boMovie ? () => setBoMovie(null) : undefined} label="Fyre movie" />
                  <div className="flex gap-1.5">
                    {(['IN', 'US'] as const).map((t) => (
                      <button key={t} type="button" className={pill(territory === t)} onClick={() => setTerritory(t)}>
                        {t === 'IN' ? 'India' : 'USA'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(['day', 'first', 'lifetime'] as const).map((k) => (
                    <button key={k} type="button" className={pill(selKind === k)} onClick={() => setSelKind(k)}>
                      {k === 'day' ? 'Day' : k === 'first' ? 'First N days' : 'Total'}
                    </button>
                  ))}
                  {selKind !== 'lifetime' && <input type="number" min={selKind === 'day' ? 0 : 1} max={120} className="w-20 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text" value={selN} onChange={(e) => setSelN(Math.max(0, Number(e.target.value) || 0))} />}
                  <button type="button" onClick={loadFyre} className="text-xs font-semibold bg-gold text-white rounded-full px-4 py-1.5 ml-auto">
                    Use Fyre data
                  </button>
                </div>
                {fyreErr && <div className="text-red text-xs">{fyreErr}</div>}

                {(chosenNumber || fyre) && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border p-3">
                      <div className="text-[11px] text-textFaint uppercase tracking-wider">Source post</div>
                      <div className="text-xl font-bold text-text">{chosenNumber?.raw ?? '—'}</div>
                      <div className="text-[11px] text-textFaint">As reported by @{author.handle}</div>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <div className="text-[11px] text-textFaint uppercase tracking-wider">Fyre tracked data</div>
                      <div className="text-xl font-bold text-gold">{fyre ? fyre.grossText : '—'}</div>
                      <div className="text-[11px] text-textFaint">{fyre ? `${fyre.title} · ${fyre.label.toLowerCase()}${fyre.final ? '' : ' · live'}` : 'Not loaded'}</div>
                    </div>
                  </div>
                )}
                {fyre && chosenNumber && (
                  <div className={`text-sm flex items-start gap-2 ${conflict ? 'text-amber' : 'text-goldDim'}`}>
                    {conflict ? <AlertTriangle size={16} className="mt-0.5 flex-none" /> : <Check size={16} className="mt-0.5 flex-none" />}
                    {conflict ? 'Numbers differ. Choose which one goes on the card — they are never mixed.' : 'The post’s figure matches Fyre’s tracked data.'}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" disabled={!fyre} className={`${pill(numberMode === 'fyre')} disabled:opacity-40`} onClick={() => setNumberMode('fyre')}>
                    Use Fyre Data
                  </button>
                  <button type="button" disabled={!chosenNumber} className={`${pill(numberMode === 'source')} disabled:opacity-40`} onClick={() => setNumberMode('source')}>
                    Use Source Post as News
                  </button>
                  <button type="button" className={pill(numberMode === 'none')} onClick={() => setNumberMode('none')}>
                    Remove Number
                  </button>
                </div>
                {numberMode === null && template === 'boxoffice' && <div className="text-amber text-xs">No figure on the card until you choose.</div>}
                {numberMode === 'source' && (
                  <label>
                    <span className={label}>Label above the reported figure</span>
                    <input className={input} value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
                    <span className="text-[11px] text-textFaint">Printed as “As reported”, with a note that it is not Fyre tracked data.</span>
                  </label>
                )}
                {strayFigures.length > 0 && (
                  <div className="text-amber text-xs flex gap-2">
                    <AlertTriangle size={14} className="flex-none mt-0.5" />
                    Your text still contains {strayFigures.map((n) => n.raw).join(', ')} from the post, next to Fyre’s {fyre?.grossText}. Edit the text so the card does not mix them.
                  </div>
                )}
                {fyre?.poster && (
                  <label className="flex items-center gap-2 text-xs text-textDim">
                    <input type="checkbox" checked={useFyrePoster} onChange={(e) => setUseFyrePoster(e.target.checked)} /> Use the Fyre movie poster as the card image
                  </label>
                )}
              </Card>
            )}

            {selectedImgs.length > 0 && (
              <Card className="p-4 grid gap-3">
                <div className="mdtype-overline text-gold">Images</div>
                {template !== 'boxoffice' && template !== 'quote' && template !== 'imageFirst' && selectedImgs.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {LAYOUTS.filter((l) => l.n <= selectedImgs.length).map((l) => (
                      <button key={l.id} type="button" className={pill(layout === l.id)} onClick={() => setLayout(l.id)}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
                {imgs.map((im, i) =>
                  im.selected ? (
                    <div key={im.url} className="grid sm:grid-cols-[80px_minmax(0,1fr)] gap-3 items-center border-t border-border pt-3">
                      <div className="text-xs text-textDim">
                        Image {i + 1}
                        {hero === i ? ' · hero' : ''}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <label>
                          <span className={label}>Fit</span>
                          <select className={input} value={im.fit} onChange={(e) => setImg(i, { fit: e.target.value as any })}>
                            <option value="fill">Fill</option>
                            <option value="fit">Fit (whole image)</option>
                          </select>
                        </label>
                        <label>
                          <span className={label}>Zoom {im.zoom.toFixed(2)}×</span>
                          <input type="range" min={1} max={3} step={0.05} value={im.zoom} onChange={(e) => setImg(i, { zoom: Number(e.target.value) })} className="w-full" />
                        </label>
                        <label>
                          <span className={label}>Position ↔ {im.posX}%</span>
                          <input type="range" min={0} max={100} value={im.posX} onChange={(e) => setImg(i, { posX: Number(e.target.value) })} className="w-full" />
                        </label>
                        <label>
                          <span className={label}>Position ↕ {im.posY}%</span>
                          <input type="range" min={0} max={100} value={im.posY} onChange={(e) => setImg(i, { posY: Number(e.target.value) })} className="w-full" />
                        </label>
                      </div>
                    </div>
                  ) : null
                )}
              </Card>
            )}
          </>
        )}
      </div>

      {/* ----------------------------------------------------------- RIGHT */}
      <div className="lg:sticky lg:top-4 grid gap-3">
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2 text-xs text-textDim">
            <span>{CARD_SIZES[size].label}</span>
            <span className="inline-flex items-center gap-1.5">
              {rendering && <Loader2 size={12} className="animate-spin" />}
              {preview ? `rendered ${preview.w} × ${preview.h}` : ''}
            </span>
          </div>
          <div className="rounded-lg overflow-hidden bg-surface2 flex items-center justify-center" style={{ aspectRatio: `${CARD_SIZES[size].w} / ${CARD_SIZES[size].h}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview ? <img src={preview.url} alt="Poster preview" className="w-full h-full object-contain" /> : <span className="text-xs text-textFaint px-6 text-center">Import an X post to start.</span>}
          </div>
          {renderErr && <div className="text-red text-xs mt-2">{renderErr}</div>}
          {preview?.removed && <div className="text-amber text-xs mt-2">Not drawable on the poster and left out: {preview.removed}</div>}
          <button type="button" disabled={!preview || rendering} onClick={download} className="mt-3 w-full text-sm font-semibold bg-gold text-white rounded-lg py-2 disabled:opacity-40 inline-flex items-center justify-center gap-2">
            <Download size={15} /> Download Poster
          </button>
        </Card>
        {imp && (
          <Card className="p-3">
            <span className={label}>Caption</span>
            <textarea
              className={input}
              rows={7}
              value={caption}
              onChange={(e) => {
                setCaption(e.target.value);
                setCaptionEdited(true);
              }}
            />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={copyCaption} className={pill(false)}>
                {copied ? <Check size={12} className="inline mr-1" /> : <Copy size={12} className="inline mr-1" />}
                {copied ? 'Copied' : 'Copy Caption'}
              </button>
              {captionEdited && (
                <button type="button" onClick={() => setCaptionEdited(false)} className={pill(false)}>
                  Rebuild from fields
                </button>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
