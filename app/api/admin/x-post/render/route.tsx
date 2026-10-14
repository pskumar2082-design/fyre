import path from 'path';
import { readFileSync } from 'fs';
import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { requireAdmin } from '@/lib/adminAuth';
import { mediaDataUri } from '@/lib/social/xFetch';
import { loadMovieAnalytics } from '@/lib/analytics/load';
import { fyreFigures, type FyreSelection } from '@/lib/social/fyreData';
import { CARD_SIZES, SocialCard, headerLabel, planCard, type CardImage, type CardSpec, type SizeId } from '@/lib/poster/socialCard';
import { isAllowedMediaUrl, type TemplateId } from '@/lib/social/xPost';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Renders one Fyre social card (PNG) at exactly the chosen size. Admin
// only. Images are either X media (pbs.twimg.com only) or a Fyre movie's
// own poster looked up by slug -- never an arbitrary URL.
const FONT_DIR = path.join(process.cwd(), 'lib/poster/fonts');
const fonts = [
  { name: 'Noto Sans', data: readFileSync(path.join(FONT_DIR, 'NotoSansLatin-Regular.woff')), style: 'normal' as const, weight: 400 as const },
  { name: 'Noto Sans', data: readFileSync(path.join(FONT_DIR, 'NotoSansLatin-Bold.woff')), style: 'normal' as const, weight: 700 as const },
  { name: 'Noto Sans', data: readFileSync(path.join(FONT_DIR, 'NotoSansLatin-ExtraBold.woff')), style: 'normal' as const, weight: 800 as const }
];
const LOGO_SRC = `data:image/png;base64,${readFileSync(path.join(process.cwd(), 'public/logo.png')).toString('base64')}`;
const ASSETS = path.join(process.cwd(), 'lib/poster/assets');
const WATERMARK: Record<string, string> = {};
for (const s of ['1080x1350', '1080x1080', '1080x1920']) WATERMARK[s] = `data:image/png;base64,${readFileSync(path.join(ASSETS, `watermark-${s}.png`)).toString('base64')}`;

const TEMPLATES: TemplateId[] = ['news', 'imageFirst', 'boxoffice', 'achievement', 'quote'];
const str = (v: unknown, max: number) => String(v ?? '').slice(0, max);
const num = (v: unknown, lo: number, hi: number, dflt: number) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : dflt);

async function fyrePoster(slug: string): Promise<{ src: string; width: number; height: number } | null> {
  const m = await loadMovieAnalytics(slug).catch(() => null);
  if (!m?.poster) return null;
  try {
    const res = await fetch(m.poster, { headers: { Accept: 'image/jpeg,image/png' }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    if (!isJpg && !isPng) return null;
    return { src: `data:image/${isJpg ? 'jpeg' : 'png'};base64,${buf.toString('base64')}`, width: 600, height: 900 };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return new Response('Unauthorized', { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b) return new Response('Bad request', { status: 400 });
  const size = (b.size in CARD_SIZES ? b.size : 'ig_portrait') as SizeId;
  const template = (TEMPLATES.includes(b.template) ? b.template : 'news') as TemplateId;

  const images: CardImage[] = [];
  for (const im of (Array.isArray(b.images) ? b.images : []).slice(0, 4)) {
    const settings = { fit: im.fit === 'fit' ? ('fit' as const) : ('fill' as const), zoom: num(im.zoom, 1, 4, 1), posX: num(im.posX, 0, 100, 50), posY: num(im.posY, 0, 100, 50) };
    if (im.source === 'fyre' && typeof im.slug === 'string') {
      const p = await fyrePoster(im.slug);
      if (p) images.push({ ...p, ...settings });
      continue;
    }
    const url = String(im.url ?? '');
    if (!isAllowedMediaUrl(url)) return new Response('Images must come from the imported X post', { status: 400 });
    try {
      images.push({ src: await mediaDataUri(url, 'large'), width: num(im.width, 1, 20000, 1000), height: num(im.height, 1, 20000, 1000), ...settings });
    } catch (err: any) {
      return new Response(`Image unavailable: ${err?.message ?? err}`, { status: 502 });
    }
  }

  // Box-office figures. 'fyre': looked up here from Fyre's own analytics
  // (the client only says which movie / territory / day) -- a card that
  // looks like Fyre data can only ever carry Fyre data. 'source': the
  // post's figure, always labelled as reported, never with metric cards.
  const n = b.numbers;
  let numbers: CardSpec['numbers'] = null;
  if (n?.mode === 'fyre') {
    const f = n.fyre && typeof n.fyre.slug === 'string' && n.fyre.selection ? await fyreFigures(n.fyre.slug, n.fyre.territory === 'US' ? 'US' : 'IN', n.fyre.selection as FyreSelection) : { error: 'Fyre selection missing' };
    if ('error' in f) return new Response(f.error, { status: 400 });
    numbers = { mode: 'fyre', label: f.label, value: f.grossText, valueLabel: 'Tracked gross', metrics: f.metrics, note: f.note };
  } else if (n?.mode === 'source') {
    numbers = { mode: 'source', label: str(n.label, 60), value: str(n.value, 30), valueLabel: 'As reported', metrics: [], note: 'Figure as reported in the source post — not Fyre tracked data' };
  }

  const spec: CardSpec = {
    template,
    size,
    accent: b.accent === 'gold' ? 'gold' : 'fyre',
    category: str(b.category, 40),
    headline: str(b.headline, 300),
    subhead: str(b.subhead, 400),
    body: str(b.body, 800),
    movie: str(b.movie, 80),
    highlight: str(b.highlight, 80),
    fact: str(b.fact, 200),
    hashtags: str(b.hashtags, 200),
    footer: str(b.footer, 40),
    images,
    imageLayout: ['single', 'split', 'grid3', 'grid4'].includes(b.imageLayout) ? b.imageLayout : 'single',
    heroMode: b.heroMode === 'full' ? 'full' : 'framed',
    numbers,
    watermark: b.watermark !== false
  };
  const plan = planCard(spec);
  const { w, h } = CARD_SIZES[size];
  return new ImageResponse(<SocialCard plan={plan} logoSrc={LOGO_SRC} watermarkLayer={WATERMARK[`${w}x${h}`] ?? null} watermark={spec.watermark} category={headerLabel(template)} />, {
    width: w,
    height: h,
    fonts,
    headers: {
      'Cache-Control': 'no-store',
      'X-Card-Width': String(w),
      'X-Card-Height': String(h),
      'X-Card-Removed': encodeURIComponent(plan.removed.join(''))
    }
  });
}
