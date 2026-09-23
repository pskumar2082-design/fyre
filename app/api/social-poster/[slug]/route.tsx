import path from 'path';
import { readFileSync } from 'fs';
import { ImageResponse } from 'next/og';
import { getMovieDetails } from '@/lib/tracktollywood/scraper';
import { buildPosterData } from '@/lib/poster/build';
import { SocialPoster, POSTER_WIDTH, computePosterHeight } from '@/lib/poster/blocks';
import { buildPosterFilename } from '@/lib/poster/filename';

export const dynamic = 'force-dynamic';
// axios (inside getMovieDetails) needs Node's http stack -- can't run on
// the edge runtime, same as every other TrackTollywood route.
export const runtime = 'nodejs';

// Same reasoning as the old report-card route this replaces: Satori's
// bundled fallback font is missing the ₹ glyph, and next/og's own
// "fetch the missing glyph from Google Fonts at request time" fallback
// failed outright in testing -- so a small local subset (committed,
// covers ASCII + ₹ + the punctuation this poster uses) is loaded with
// zero network calls instead.
const ASSET_DIR = path.join(process.cwd(), 'lib/poster/fonts');
const fontRegular = readFileSync(path.join(ASSET_DIR, 'NotoSans-Regular.woff'));
const fontBold = readFileSync(path.join(ASSET_DIR, 'NotoSans-Bold.woff'));

// fyre's real logo (public/logo.png), embedded as a data URI so Satori
// never has to fetch it over the network mid-render -- the same reason
// the fonts above are loaded from disk rather than a URL.
const logoBytes = readFileSync(path.join(process.cwd(), 'public/logo.png'));
const LOGO_SRC = `data:image/png;base64,${logoBytes.toString('base64')}`;

function parseRows(raw: string | null): 'all' | number {
  if (!raw || raw === 'all') return 'all';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 'all';
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const url = new URL(req.url);
  const tableLabel = url.searchParams.get('table');
  const rowsMode = parseRows(url.searchParams.get('rows'));
  const watermark = url.searchParams.get('watermark') !== '0';

  let details;
  try {
    details = await getMovieDetails(params.slug);
  } catch {
    details = null;
  }
  if (!details) {
    return new Response(`TrackTollywood has no movie at slug "${params.slug}".`, { status: 404 });
  }
  if (!tableLabel) {
    return new Response('Missing "table" query parameter -- pass the exact report table label (see /api/tracktollywood/[slug] for the list).', {
      status: 400
    });
  }

  const result = buildPosterData(details, tableLabel);
  if ('error' in result) {
    return new Response(result.error, { status: 404 });
  }

  const fullRowCount = result.data.rows.length;
  const rows = rowsMode === 'all' ? result.data.rows : result.data.rows.slice(0, rowsMode);
  const data = { ...result.data, rows };

  const height = computePosterHeight(rows.length);
  const filename = buildPosterFilename(params.slug, tableLabel);

  return new ImageResponse(
    <SocialPoster data={data} logoSrc={LOGO_SRC} watermark={watermark} height={height} />,
    {
      width: POSTER_WIDTH,
      height,
      // next/og's ImageResponse has no separate pixel-density/scale
      // option (checked its type defs -- only width/height/fonts/emoji/
      // debug exist), so "high resolution" here comes from rendering
      // directly at the full 1080px target width with Satori's own
      // vector text -- there's no bitmap upscale step to go soft, unlike
      // a screenshot-based capture at a smaller size blown up after the
      // fact.
      fonts: [
        { name: 'Noto Sans', data: fontRegular, style: 'normal', weight: 400 },
        { name: 'Noto Sans', data: fontBold, style: 'normal', weight: 700 }
      ],
      headers: {
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-Poster-Row-Count': String(fullRowCount)
      }
    }
  );
}
