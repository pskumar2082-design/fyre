import path from 'path';
import { readFileSync } from 'fs';
import { ImageResponse } from 'next/og';
import { getComparison } from '@/lib/analytics/compare';
import { contextLine, parseCompareParams } from '@/lib/analytics/query';
import type { MetricKey } from '@/lib/analytics/types';
import { TerritoryPoster, XPoster, X_WIDTH, fitToHeight, territoryPosterHeight, xPosterHeight, type XPosterOptions } from '@/lib/poster/xPoster';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// X-ready "Movie Report" (one movie) / "Movie Comparison" (two movies)
// poster. Takes exactly the Movie Comparison page's query string and renders
// the same getComparison() view model -- no poster-specific numbers.
//   ?movies=a,b&basis=day&day=1&dimension=state&metric=gross&limit=5
//   &chart=1&format=auto|1080x1350&watermark=0
//   &territory=in (default) | us (USA · Indian-language screenings, USD)
//                | both (one movie: India and USA side by side, never added)
const ASSET_DIR = path.join(process.cwd(), 'lib/poster/fonts');
const fontRegular = readFileSync(path.join(ASSET_DIR, 'NotoSans-Regular.woff'));
const fontBold = readFileSync(path.join(ASSET_DIR, 'NotoSans-Bold.woff'));
const logoBytes = readFileSync(path.join(process.cwd(), 'public/logo.png'));
const LOGO_SRC = `data:image/png;base64,${logoBytes.toString('base64')}`;

// Satori can only draw JPEG/PNG; fetch the poster ourselves and embed it,
// or fall back to a "No poster" tile.
async function posterData(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { Accept: 'image/jpeg,image/png' } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    if (!isJpg && !isPng) return null;
    return `data:image/${isJpg ? 'jpeg' : 'png'};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  // A single movie is a Movie Report; parseCompareParams needs two, so
  // duplicate-free single-slug requests are handled here.
  const movies = (q.get('movies') ?? '').split(',').filter(Boolean);
  if (movies.length === 1) q.set('movies', `${movies[0]},${movies[0]}`);
  const parsed = parseCompareParams(q);
  if ('error' in parsed) return new Response(parsed.error, { status: 400 });
  if (movies.length === 1) parsed.slugs = [movies[0]];
  parsed.slugs = parsed.slugs.slice(0, 2);
  parsed.trend = true;
  const fonts = [
    { name: 'Noto Sans', data: fontRegular, style: 'normal' as const, weight: 400 as const },
    { name: 'Noto Sans', data: fontBold, style: 'normal' as const, weight: 700 as const }
  ];

  if ((q.get('territory') ?? '').toLowerCase() === 'both') {
    const slug = parsed.slugs[0];
    const [india, usa] = await Promise.all([getComparison({ ...parsed, slugs: [slug], territory: 'IN' }), getComparison({ ...parsed, slugs: [slug], territory: 'US' })]);
    if (!india.movies.length && !usa.movies.length) return new Response('Movie not found', { status: 404 });
    if (!india.movies[0]?.available && !usa.movies[0]?.available) return new Response(`Nothing tracked for ${india.selectionLabel}`, { status: 404 });
    const o: XPosterOptions = { metric: (parsed.metric ?? 'gross') as MetricKey, chart: false, summaryMetrics: ['gross', 'tickets', 'shows', 'occupancy'] };
    const what = contextLine(parsed.selection).split(' · ')[0];
    const height = territoryPosterHeight(india, usa, o);
    const image = await posterData(india.movies[0]?.poster ?? usa.movies[0]?.poster ?? null);
    const name = `fyre-${slug}-india-usa-${india.selectionLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    return new ImageResponse(<TerritoryPoster india={india} usa={usa} o={o} image={image} logoSrc={LOGO_SRC} watermark={q.get('watermark') !== '0'} height={height} context={`${what} · INDIA + USA`} />, {
      width: X_WIDTH,
      height,
      fonts,
      headers: { 'Content-Disposition': `inline; filename="${name}"` }
    });
  }

  const cmp = await getComparison(parsed);
  if (cmp.movies.length === 0) return new Response('Movie not found', { status: 404 });
  if (cmp.movies.every((m) => !m.available)) return new Response(`Nothing tracked for ${cmp.selectionLabel}: ${cmp.movies.map((m) => `${m.title} — ${m.reason}`).join('; ')}`, { status: 404 });

  const metric = (parsed.metric ?? 'gross') as MetricKey;
  const opts: XPosterOptions = {
    metric,
    chart: q.get('chart') === '1',
    summaryMetrics: cmp.currency === 'USD' ? (cmp.movies.length === 1 ? ['gross', 'tickets', 'shows', 'venues', 'occupancy', 'atp'] : ['gross', 'tickets', 'shows', 'venues', 'occupancy']) : ['gross', 'tickets', 'shows', 'occupancy']
  };
  let data = cmp;
  let o = opts;
  let height = xPosterHeight(data, o);
  if (q.get('format') === '1080x1350') {
    height = 1350;
    ({ c: data, o } = fitToHeight(data, o, height));
  }

  const images = await Promise.all(cmp.movies.map((m) => posterData(m.poster)));
  const name = `fyre-${cmp.movies.map((m) => m.slug).join('-vs-')}${cmp.territory === 'US' ? '-usa' : ''}-${cmp.selectionLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  return new ImageResponse(<XPoster c={data} o={o} images={images} logoSrc={LOGO_SRC} watermark={q.get('watermark') !== '0'} height={height} />, {
    width: X_WIDTH,
    height,
    fonts,
    headers: { 'Content-Disposition': `inline; filename="${name}"`, 'X-Poster-Rows': String(data.rows.length), 'X-Poster-Total-Rows': String(cmp.totalRows) }
  });
}
