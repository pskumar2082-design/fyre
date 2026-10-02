// Fyre social cards: an X post (or any news item) turned into a branded
// Fyre graphic. Five fixed templates on one shared frame -- same
// background, header, footer, type, accent lines and watermark as the
// box-office posters (lib/poster/brand.tsx) -- so every card on the Fyre
// profiles reads as one publication.
//
// Layout is computed, not left to chance: planCard() decides every block's
// height with the font's real metrics (lib/poster/text.ts), shrinking type
// step by step until everything fits the chosen canvas; images take what is
// left. renderCard() draws exactly that plan. Nothing can be clipped.
import { ACCENTS, BORDER, CARD, DIM, FAINT, NAVY, PosterWatermark, SITE, SOCIAL_HANDLE, WHITE, type Accent, type AccentId } from './brand';
import { fitText, highlightSegments, measure, posterText, type Fitted, type Weight } from './text';
import { titleCase, type TemplateId } from '../social/xPost';

import { CARD_SIZES, DEFAULT_SIZE, type SizeId } from './cardSizes';
export { CARD_SIZES, DEFAULT_SIZE, type SizeId };

export type ImageFit = 'fill' | 'fit';
export type CardImage = { src: string; width: number; height: number; fit: ImageFit; zoom: number; posX: number; posY: number };
export type ImageLayout = 'single' | 'split' | 'grid3' | 'grid4';

// Box-office figures on a card. 'fyre' = Fyre's own tracked analytics;
// 'source' = a figure as reported in the post (news, never styled as Fyre
// data -- no metric cards, labelled "AS REPORTED").
export type CardNumbers = {
  mode: 'fyre' | 'source';
  label: string;
  value: string;
  valueLabel: string;
  metrics: { label: string; value: string }[];
  note: string;
};

export type CardSpec = {
  template: TemplateId;
  size: SizeId;
  accent: AccentId;
  category: string;
  headline: string;
  subhead: string;
  body: string;
  movie: string;
  highlight: string;
  fact: string;
  hashtags: string;
  footer: string;
  images: CardImage[];
  imageLayout: ImageLayout;
  heroMode: 'framed' | 'full';
  numbers: CardNumbers | null;
  watermark: boolean;
};

const HEADER = 72;
const FOOTER = 56;

export type Dims = { W: number; H: number; x: number; w: number; top: number; bottom: number; avail: number };

export function dims(size: SizeId): Dims {
  const { w: W, h: H } = CARD_SIZES[size];
  const pad = 64;
  // Stories: keep clear of the app's own top bar and reply box.
  const safeTop = size === 'story' ? 150 : 0;
  const safeBottom = size === 'story' ? 190 : 0;
  const top = pad + safeTop;
  const bottom = H - pad - safeBottom;
  return { W, H, x: pad, w: W - pad * 2, top, bottom, avail: bottom - top };
}

type Color = 'white' | 'dim' | 'faint' | 'accent';
export type Block =
  | { t: 'header'; h: number; category: string }
  | { t: 'gap'; h: number }
  | { t: 'spacer'; h: number }
  | { t: 'category'; h: number; text: string }
  | { t: 'text'; h: number; f: Fitted; weight: Weight; color: Color; letterSpacing?: number; highlight?: string }
  | { t: 'quoteMark'; h: number }
  | { t: 'fact'; h: number; f: Fitted }
  | { t: 'images'; h: number; w: number; images: CardImage[]; layout: ImageLayout; radius: number }
  | { t: 'value'; h: number; value: Fitted; label: string }
  | { t: 'metrics'; h: number; items: { label: string; value: string }[] }
  | { t: 'tags'; h: number; text: string }
  | { t: 'footer'; h: number; text: string }
  | { t: 'columns'; h: number; left: Block[]; leftW: number; right: Block[]; rightW: number; gap: number };

export type Plan = { size: SizeId; d: Dims; accent: Accent; blocks: Block[]; background: CardImage | null; backgroundMode: 'none' | 'faint' | 'full'; removed: string[] };

const sum = (bs: Block[]) => bs.reduce((a, b) => a + b.h, 0);

function clean(s: string, removed: Set<string>): string {
  const r = posterText(s ?? '');
  r.removed.forEach((c) => removed.add(c));
  return r.text;
}

function text(s: string, o: { w: number; lines: number; max: number; min: number; weight: Weight; lh?: number; color: Color; ls?: number; highlight?: string }): Block | null {
  if (!s.trim()) return null;
  const f = fitText(s, { maxWidth: o.w, maxLines: o.lines, maxSize: o.max, minSize: o.min, weight: o.weight, lineHeight: o.lh ?? 1.12, letterSpacing: o.ls });
  return { t: 'text', h: f.height, f, weight: o.weight, color: o.color, letterSpacing: o.ls, highlight: o.highlight };
}

const gap = (h: number): Block => ({ t: 'gap', h });
const keep = (bs: (Block | null | false | undefined | '')[]): Block[] => bs.filter(Boolean) as Block[];

// Hashtags on one line: whole tags only, as many as fit.
function tagsBlock(tags: string, w: number): Block | null {
  const list = tags.split(/\s+/).filter((t) => /^#\S+$/.test(t));
  let line = '';
  for (const t of list) {
    const next = line ? `${line}  ${t}` : t;
    if (measure(next, 20, 700, 0.5) > w) break;
    line = next;
  }
  return line ? { t: 'tags', h: 34, text: line } : null;
}

function imagesBlock(spec: CardSpec, h: number, w: number, radius = 18): Block | null {
  if (!spec.images.length || h <= 0) return null;
  return { t: 'images', h, w, images: spec.images, layout: spec.images.length === 1 ? 'single' : spec.imageLayout, radius };
}

// Leftover height is shared out between the gaps (up to `maxPerGap` each)
// so a short card is balanced instead of top-heavy; anything beyond that
// goes into one spacer at `spacerAt`.
function spread(blocks: Block[], rest: number, spacerAt: number, maxPerGap = 44): Block[] {
  if (rest <= 0) return blocks;
  const gaps = blocks.map((b, i) => (b.t === 'gap' && i > 0 && i < spacerAt ? i : -1)).filter((i) => i >= 0);
  const per = gaps.length ? Math.min(maxPerGap, Math.floor(rest / gaps.length)) : 0;
  const out = blocks.map((b, i) => (gaps.includes(i) ? { ...b, h: b.h + per } : b));
  const left = rest - per * gaps.length;
  return left > 0 ? [...out.slice(0, spacerAt), { t: 'spacer', h: left } as Block, ...out.slice(spacerAt)] : out;
}

// Compaction levels: each template tries roomy type first, then tighter.
const LEVELS = [0, 1, 2, 3];

function planNews(spec: CardSpec, d: Dims, removed: Set<string>): Block[] {
  const hasImg = spec.images.length > 0;
  const head = clean(spec.headline || spec.movie, removed);
  const sub = clean(spec.subhead, removed);
  const body = clean(spec.body, removed);
  const fact = clean(spec.fact, removed);
  const tags = tagsBlock(clean(spec.hashtags, removed), d.w);
  let out: Block[] = [];
  for (const lv of LEVELS) {
    const big = !hasImg;
    const hl = text(head, { w: d.w, lines: big ? 6 : 4, max: (big ? 104 : 84) - lv * 10, min: 40 - lv * 2, weight: 800, lh: 1.06, color: 'white', highlight: spec.highlight });
    const sb = text(sub, { w: d.w, lines: big ? 3 : 2, max: 36 - lv * 3, min: 24, weight: 700, lh: 1.25, color: 'white' });
    const bd = text(body, { w: d.w, lines: big ? 6 : Math.max(2, 4 - lv), max: 28 - lv * 2, min: 20, weight: 400, lh: 1.4, color: 'dim' });
    const fc = fact ? fitText(fact, { maxWidth: d.w - 60, maxLines: 2, maxSize: 30 - lv * 2, minSize: 22, weight: 700, lineHeight: 1.25 }) : null;
    const g = 28 - lv * 6;
    const top = keep([{ t: 'header', h: HEADER, category: '' }, gap(g), { t: 'category', h: 30, text: clean(spec.category, removed) }, gap(14), hl, sb && gap(16), sb, bd && gap(12), bd]);
    const bottom = keep([fc && gap(g), fc && { t: 'fact', h: fc.height + 36, f: fc }, gap(g), tags, { t: 'footer', h: FOOTER, text: spec.footer }]);
    const rest = d.avail - sum(top) - sum(bottom) - (hasImg ? g : 0);
    out = hasImg ? [...top, gap(g), imagesBlock(spec, rest, d.w)!, ...bottom] : spread([...top, ...bottom], rest, top.length);
    if ((!hasImg && rest >= 0) || (hasImg && rest >= d.avail * (lv < 3 ? 0.34 : 0.22))) break;
  }
  return out;
}

function planImageFirst(spec: CardSpec, d: Dims, removed: Set<string>): Block[] {
  const title = clean(spec.movie || spec.headline, removed);
  const rawSub = clean(spec.movie ? spec.headline || spec.subhead : spec.subhead, removed);
  // The announcement line reads as a sentence even when the headline was
  // written in capitals.
  const sub = rawSub && rawSub === rawSub.toUpperCase() && /[A-Z]{3}/.test(rawSub) ? titleCase(rawSub) : rawSub;
  const tags = tagsBlock(clean(spec.hashtags, removed), d.w);
  const full = spec.heroMode === 'full';
  let out: Block[] = [];
  for (const lv of LEVELS) {
    const tl = text(title.toUpperCase(), { w: d.w, lines: 2, max: 100 - lv * 12, min: 44, weight: 800, lh: 1.04, color: 'white', highlight: spec.highlight });
    const sb = text(sub, { w: d.w, lines: 3, max: 32 - lv * 3, min: 22, weight: 400, lh: 1.35, color: 'dim' });
    const g = 26 - lv * 5;
    const textBlocks = keep([{ t: 'category', h: 30, text: clean(spec.category, removed) }, gap(12), tl, sb && gap(14), sb, gap(g), tags, { t: 'footer', h: FOOTER, text: spec.footer }]);
    const rest = d.avail - HEADER - sum(textBlocks) - g * 2;
    if (full || !spec.images.length) {
      out = [{ t: 'header', h: HEADER, category: '' }, { t: 'spacer', h: Math.max(0, d.avail - HEADER - sum(textBlocks)) }, ...textBlocks];
      break;
    }
    out = [{ t: 'header', h: HEADER, category: '' }, gap(g), imagesBlock(spec, rest, d.w, 14)!, gap(g), ...textBlocks];
    if (rest >= d.avail * 0.42 || lv === 3) break;
  }
  return out;
}

function planBoxOffice(spec: CardSpec, d: Dims, removed: Set<string>): Block[] {
  const n = spec.numbers;
  const movie = clean(spec.movie, removed);
  const head = clean(spec.headline, removed);
  const sub = clean([spec.subhead, spec.body].filter(Boolean).join(' '), removed);
  const tags = tagsBlock(clean(spec.hashtags, removed), d.w);
  let out: Block[] = [];
  // Largest poster (and roomiest type) that fits; the rest is spread out.
  const tries: [number, number][] = [];
  for (const lv of LEVELS) for (const ph of [480, 420, 360, 330 - lv * 40]) if (ph >= 220) tries.push([lv, ph]);
  for (const [lv, ph] of tries) {
    const g = 26 - lv * 6;
    const posterH = spec.images.length ? ph : 0;
    const posterW = Math.round(posterH * (2 / 3));
    const colW = posterW ? d.w - posterW - 36 : d.w;
    const right = keep([
      text(movie.toUpperCase(), { w: colW, lines: 2, max: 64 - lv * 6, min: 34, weight: 800, lh: 1.05, color: 'white' }),
      n && gap(12),
      n && text(clean(n.label, removed).toUpperCase(), { w: colW, lines: 1, max: 24, min: 18, weight: 700, color: 'accent', ls: 3 }),
      n && gap(18),
      n && { t: 'value', h: 0, value: fitText(clean(n.value, removed), { maxWidth: colW, maxLines: 1, maxSize: 120 - lv * 10, minSize: 56, weight: 800, lineHeight: 1 }), label: clean(n.valueLabel, removed).toUpperCase() }
    ]).map((b) => (b.t === 'value' ? { ...b, h: b.value.height + 34 } : b));
    const rowH = Math.max(posterH, sum(right));
    const metrics: Block | null = n && n.mode === 'fyre' && n.metrics.length ? { t: 'metrics', h: 124 - lv * 8, items: n.metrics.slice(0, 3) } : null;
    const hl = text(head, { w: d.w, lines: n ? 3 : 4, max: (n ? 42 : 64) - lv * 4, min: 26, weight: 800, lh: 1.15, color: 'white', highlight: spec.highlight });
    const sb = text(sub, { w: d.w, lines: Math.max(2, 4 - lv), max: 26 - lv * 2, min: 20, weight: 400, lh: 1.4, color: 'dim' });
    const note = n ? text(clean(n.note, removed), { w: d.w, lines: 2, max: 18, min: 15, weight: 400, lh: 1.35, color: 'faint' }) : null;
    const cols: Block = { t: 'columns', h: rowH, leftW: posterW, rightW: colW, gap: posterW ? 36 : 0, left: posterW ? [imagesBlock({ ...spec, images: spec.images.slice(0, 1) }, posterH, posterW, 14)!] : [], right };
    const blocks = keep([{ t: 'header', h: HEADER, category: '' }, gap(g), cols, metrics && gap(g), metrics, hl && gap(g), hl, sb && gap(12), sb]);
    const bottom = keep([note && gap(12), note, gap(g * 0.6), tags, { t: 'footer', h: FOOTER, text: spec.footer }]);
    const rest = d.avail - sum(blocks) - sum(bottom);
    out = spread([...blocks, ...bottom], rest, blocks.length, 90);
    if (rest >= 0) break;
  }
  return out;
}

function planAchievement(spec: CardSpec, d: Dims, removed: Set<string>): Block[] {
  const movie = clean(spec.movie, removed);
  const head = clean(spec.headline, removed);
  const sub = clean([spec.subhead, spec.body].filter(Boolean).join(' '), removed);
  const tags = tagsBlock(clean(spec.hashtags, removed), d.w);
  const hasImg = spec.images.length > 0;
  let out: Block[] = [];
  for (const lv of LEVELS) {
    const g = 28 - lv * 6;
    const top = keep([
      { t: 'header', h: HEADER, category: '' },
      gap(g),
      { t: 'category', h: 30, text: clean(spec.category, removed) },
      gap(16),
      movie && text(movie.toUpperCase(), { w: d.w, lines: 1, max: 44 - lv * 4, min: 28, weight: 800, color: 'white', ls: 3 }),
      movie && gap(10),
      text(head.toUpperCase(), { w: d.w, lines: 3, max: (hasImg ? 120 : 140) - lv * 14, min: 52, weight: 800, lh: 1.02, color: 'accent', highlight: spec.highlight }),
      sub && gap(18),
      sub && text(sub, { w: d.w, lines: hasImg ? 3 - (lv > 1 ? 1 : 0) : 5, max: 30 - lv * 3, min: 22, weight: 400, lh: 1.38, color: 'dim' })
    ]);
    const bottom = keep([gap(g), tags, { t: 'footer', h: FOOTER, text: spec.footer }]);
    const rest = d.avail - sum(top) - sum(bottom) - (hasImg ? g : 0);
    out = hasImg ? [...top, gap(g), imagesBlock(spec, rest, d.w)!, ...bottom] : spread([...top, ...bottom], rest, top.length);
    if ((!hasImg && rest >= 0) || (hasImg && rest >= d.avail * (lv < 3 ? 0.3 : 0.2))) break;
  }
  return out;
}

function planQuote(spec: CardSpec, d: Dims, removed: Set<string>): Block[] {
  const statement = clean(spec.headline || spec.body, removed);
  const context = clean(spec.headline ? [spec.subhead, spec.body].filter(Boolean).join(' ') : spec.subhead, removed);
  const by = clean(spec.movie, removed);
  const tags = tagsBlock(clean(spec.hashtags, removed), d.w);
  const hasImg = spec.images.length > 0;
  const colGap = 36;
  const leftW = hasImg ? Math.round((d.w - colGap) * 0.6) : d.w;
  const rightW = hasImg ? d.w - leftW - colGap : 0;
  const bottom = keep([gap(24), tags, { t: 'footer', h: FOOTER, text: spec.footer }]);
  const colH = d.avail - HEADER - 28 - sum(bottom);
  let left: Block[] = [];
  for (const lv of LEVELS) {
    const ctx = text(context, { w: leftW, lines: 5 - lv, max: 28 - lv * 2, min: 20, weight: 400, lh: 1.42, color: 'dim' });
    const att = by ? text(by.toUpperCase(), { w: leftW, lines: 1, max: 24, min: 18, weight: 700, color: 'accent', ls: 3 }) : null;
    const fixed = 30 + 20 + 104 + (ctx ? ctx.h + 22 : 0) + (att ? att.h + 22 : 0);
    const lineH = 1.18;
    const maxSize = (hasImg ? 58 : 72) - lv * 6;
    const maxLines = Math.max(3, Math.floor((colH - fixed) / Math.round(30 * lineH)));
    const st = text(statement, { w: leftW, lines: Math.min(maxLines, 9), max: maxSize, min: 30, weight: 700, lh: lineH, color: 'white', highlight: spec.highlight });
    left = keep([{ t: 'category', h: 30, text: clean(spec.category, removed) }, gap(20), { t: 'quoteMark', h: 104 }, st, ctx && gap(22), ctx, att && gap(22), att]);
    if (sum(left) <= colH) break;
  }
  left = spread(left, colH - sum(left), left.length, 70);
  const right = hasImg ? [imagesBlock({ ...spec, images: spec.images.slice(0, 1) }, colH, rightW, 16)!] : [];
  return [{ t: 'header', h: HEADER, category: '' }, gap(28), { t: 'columns', h: colH, left, leftW, right, rightW, gap: hasImg ? colGap : 0 }, ...bottom];
}

export function planCard(spec: CardSpec): Plan {
  const d = dims(spec.size);
  const removed = new Set<string>();
  const plans: Record<TemplateId, () => Block[]> = {
    news: () => planNews(spec, d, removed),
    imageFirst: () => planImageFirst(spec, d, removed),
    boxoffice: () => planBoxOffice(spec, d, removed),
    achievement: () => planAchievement(spec, d, removed),
    quote: () => planQuote(spec, d, removed)
  };
  const blocks = (plans[spec.template] ?? plans.news)();
  const hero = spec.images[0] ?? null;
  const backgroundMode = spec.template === 'imageFirst' && hero ? (spec.heroMode === 'full' ? 'full' : 'faint') : 'none';
  return { size: spec.size, d, accent: ACCENTS[spec.accent] ?? ACCENTS.fyre, blocks, background: backgroundMode === 'none' ? null : hero, backgroundMode, removed: [...removed] };
}

// Total height of a plan's blocks -- never more than the canvas allows.
export function planHeight(p: Plan): number {
  return sum(p.blocks);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

// Where an image sits in its box: 'fill' covers the box (cropping), 'fit'
// shows the whole image; zoom scales either; posX/posY (0-100) pick which
// part shows (50/50 = centred).
export function imageGeometry(img: Pick<CardImage, 'width' | 'height' | 'fit' | 'zoom' | 'posX' | 'posY'>, cw: number, ch: number) {
  const iw = img.width || cw;
  const ih = img.height || ch;
  const base = img.fit === 'fit' ? Math.min(cw / iw, ch / ih) : Math.max(cw / iw, ch / ih);
  const s = base * Math.max(1, Math.min(4, img.zoom || 1));
  const w = Math.round(iw * s);
  const h = Math.round(ih * s);
  const px = Math.max(0, Math.min(100, img.posX ?? 50)) / 100;
  const py = Math.max(0, Math.min(100, img.posY ?? 50)) / 100;
  return { w, h, left: Math.round((cw - w) * px) || 0, top: Math.round((ch - h) * py) || 0 };
}

function ImageBox({ img, w, h, radius }: { img: CardImage; w: number; h: number; radius: number }) {
  const g = imageGeometry(img, w, h);
  return (
    <div style={{ display: 'flex', position: 'relative', width: w, height: h, borderRadius: radius, overflow: 'hidden', background: CARD, border: `1px solid ${BORDER}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.src} width={g.w} height={g.h} style={{ position: 'absolute', left: g.left, top: g.top, width: g.w, height: g.h }} />
    </div>
  );
}

// Single hero / 2-image split / 3-image grid (one large + two stacked) /
// 4-image grid, inside the Fyre frame.
function Images({ b }: { b: Extract<Block, { t: 'images' }> }) {
  const G = 10;
  const imgs = b.images;
  const box = (i: number, w: number, h: number) => (imgs[i] ? <ImageBox key={i} img={imgs[i]} w={w} h={h} radius={b.radius} /> : null);
  const half = Math.floor((b.w - G) / 2);
  const halfH = Math.floor((b.h - G) / 2);
  let inner;
  if (b.layout === 'single' || imgs.length === 1) inner = box(0, b.w, b.h);
  else if (b.layout === 'split' || imgs.length === 2) inner = <div style={{ display: 'flex', gap: G }}>{[box(0, half, b.h), box(1, b.w - half - G, b.h)]}</div>;
  else if (b.layout === 'grid3' || imgs.length === 3)
    inner = (
      <div style={{ display: 'flex', gap: G }}>
        {box(0, half, b.h)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: G }}>{[box(1, b.w - half - G, halfH), box(2, b.w - half - G, b.h - halfH - G)]}</div>
      </div>
    );
  else
    inner = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: G }}>
        <div style={{ display: 'flex', gap: G }}>{[box(0, half, halfH), box(1, b.w - half - G, halfH)]}</div>
        <div style={{ display: 'flex', gap: G }}>{[box(2, half, b.h - halfH - G), box(3, b.w - half - G, b.h - halfH - G)]}</div>
      </div>
    );
  return <div style={{ display: 'flex', width: b.w, height: b.h }}>{inner}</div>;
}

function colorOf(c: Color, a: Accent): string {
  return c === 'white' ? WHITE : c === 'dim' ? DIM : c === 'faint' ? FAINT : a.text;
}

function Lines({ f, weight, color, hot, letterSpacing, highlight }: { f: Fitted; weight: Weight; color: string; hot: string; letterSpacing?: number; highlight?: string }) {
  const segs = highlightSegments(f.lines, highlight ?? '');
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {segs.map((line, i) => (
        <div key={i} style={{ display: 'flex', height: f.lineHeightPx, fontSize: f.size, lineHeight: `${f.lineHeightPx}px`, fontWeight: weight, color, letterSpacing: letterSpacing ?? 0, whiteSpace: 'pre' }}>
          {line.map((s, j) => (
            <span key={j} style={{ color: s.hot ? hot : color, whiteSpace: 'pre' }}>
              {s.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Header({ logoSrc, category, a }: { logoSrc: string; category: string; a: Accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: HEADER }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} width={116} height={48} style={{ objectFit: 'contain' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: WHITE, letterSpacing: 8 }}>FYRE</div>
        <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: a.text, letterSpacing: 4 }}>{category || 'MOVIE NEWS'}</div>
      </div>
    </div>
  );
}

function BlockView({ b, p, logoSrc }: { b: Block; p: Plan; logoSrc: string }) {
  const a = p.accent;
  switch (b.t) {
    case 'header':
      return <Header logoSrc={logoSrc} category="" a={a} />;
    case 'gap':
    case 'spacer':
      return <div style={{ display: 'flex', height: b.h, flexShrink: 0 }} />;
    case 'category':
      return (
        <div style={{ display: 'flex', alignItems: 'center', height: b.h, gap: 14 }}>
          <div style={{ display: 'flex', width: 44, height: 3, background: a.line }} />
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: a.text, letterSpacing: 5 }}>{b.text.toUpperCase()}</div>
        </div>
      );
    case 'text':
      return <Lines f={b.f} weight={b.weight} color={colorOf(b.color, a)} hot={b.color === 'accent' ? WHITE : a.text} letterSpacing={b.letterSpacing} highlight={b.highlight} />;
    case 'quoteMark':
      return <div style={{ display: 'flex', height: b.h, fontSize: 170, lineHeight: '170px', fontWeight: 800, color: a.text, marginTop: -6 }}>“</div>;
    case 'fact':
      return (
        <div style={{ display: 'flex', height: b.h, alignItems: 'center', borderLeft: `4px solid ${a.line}`, background: a.tint, padding: '0 26px', borderRadius: 6 }}>
          <Lines f={b.f} weight={700} color={WHITE} hot={a.text} />
        </div>
      );
    case 'images':
      return <Images b={b} />;
    case 'value':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: b.h }}>
          <Lines f={b.value} weight={800} color={a.text} hot={a.text} />
          <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: FAINT, letterSpacing: 4, marginTop: 8 }}>{b.label}</div>
        </div>
      );
    case 'metrics':
      return (
        <div style={{ display: 'flex', gap: 16, height: b.h }}>
          {b.items.map((m) => (
            <div key={m.label} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, background: CARD, border: `1px solid ${BORDER}`, borderTop: `3px solid ${a.line}`, borderRadius: 14, padding: '0 22px' }}>
              <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: FAINT, letterSpacing: 3 }}>{m.label.toUpperCase()}</div>
              <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: WHITE, marginTop: 6 }}>{m.value}</div>
            </div>
          ))}
        </div>
      );
    case 'tags':
      return <div style={{ display: 'flex', height: b.h, alignItems: 'center', fontSize: 20, fontWeight: 700, color: a.text, letterSpacing: 0.5, whiteSpace: 'pre' }}>{b.text}</div>;
    case 'footer':
      return (
        <div style={{ display: 'flex', height: b.h, alignItems: 'flex-end', justifyContent: 'space-between', borderTop: `1px solid ${BORDER}`, paddingBottom: 2 }}>
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: WHITE }}>{posterText(b.text || SOCIAL_HANDLE).text}</div>
          <div style={{ display: 'flex', width: 54, height: 3, background: a.line, marginBottom: 10 }} />
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: DIM }}>{SITE}</div>
        </div>
      );
    case 'columns':
      return (
        <div style={{ display: 'flex', height: b.h, gap: b.gap }}>
          {b.leftW > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', width: b.leftW }}>
              {b.left.map((x, i) => (
                <BlockView key={i} b={x} p={p} logoSrc={logoSrc} />
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', width: b.rightW, justifyContent: b.right.some((x) => x.t === 'images') ? 'flex-start' : 'center' }}>
            {b.right.map((x, i) => (
              <BlockView key={i} b={x} p={p} logoSrc={logoSrc} />
            ))}
          </div>
        </div>
      );
  }
}

// The header's right-hand label: the publication section, like the
// box-office posters' "MOVIE REPORT".
export function headerLabel(template: TemplateId): string {
  return template === 'boxoffice' ? 'BOX OFFICE' : 'MOVIE NEWS';
}

// watermarkLayer: the brand watermark (PosterWatermark) pre-rendered for
// this canvas size (lib/poster/assets/watermark-WxH.png, same tiles, same
// opacity). Drawing its ~100 rotated logos live takes seconds per render;
// one image keeps the live preview quick.
export function SocialCard({ plan, logoSrc, watermarkLayer, watermark, category }: { plan: Plan; logoSrc: string; watermarkLayer?: string | null; watermark: boolean; category: string }) {
  const { d, accent: a } = plan;
  const bg = plan.background;
  const g = bg ? imageGeometry(bg, d.W, d.H) : null;
  return (
    <div style={{ width: d.W, height: d.H, display: 'flex', position: 'relative', background: NAVY, fontFamily: 'Noto Sans', overflow: 'hidden' }}>
      {bg && g && (
        <div style={{ display: 'flex', position: 'absolute', left: 0, top: 0, width: d.W, height: d.H, opacity: plan.backgroundMode === 'full' ? 1 : 0.12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bg.src} width={g.w} height={g.h} style={{ position: 'absolute', left: g.left, top: g.top, width: g.w, height: g.h }} />
        </div>
      )}
      {bg && (
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: 0,
            top: 0,
            width: d.W,
            height: d.H,
            backgroundImage:
              plan.backgroundMode === 'full'
                ? `linear-gradient(to bottom, rgba(20,22,28,0.78) 0%, rgba(20,22,28,0) 22%, rgba(20,22,28,0) 40%, rgba(20,22,28,0.92) 70%, ${NAVY} 100%)`
                : `linear-gradient(to bottom, rgba(20,22,28,0.92) 0%, rgba(20,22,28,0.7) 30%, rgba(20,22,28,0.7) 60%, rgba(20,22,28,0.95) 100%)`
          }}
        />
      )}
      {watermark &&
        !bg &&
        (watermarkLayer ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={watermarkLayer} width={d.W} height={d.H} style={{ position: 'absolute', left: 0, top: 0, width: d.W, height: d.H }} />
        ) : (
          <PosterWatermark logoSrc={logoSrc} width={d.W} height={d.H} opacity={0.03} />
        ))}
      {/* thin accent frame */}
      <div style={{ display: 'flex', position: 'absolute', left: 24, top: 24, width: d.W - 48, height: d.H - 48, border: `1px solid ${a.line}`, opacity: 0.45, borderRadius: 4 }} />
      <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', left: d.x, top: d.top, width: d.w, height: d.avail }}>
        {plan.blocks.map((b, i) =>
          b.t === 'header' ? <Header key={i} logoSrc={logoSrc} category={posterText(category).text.toUpperCase()} a={a} /> : <BlockView key={i} b={b} p={plan} logoSrc={logoSrc} />
        )}
      </div>
    </div>
  );
}
