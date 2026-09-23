import path from 'path';
import { readFileSync } from 'fs';
import { ImageResponse } from 'next/og';
import { getMovieDetails } from '@/lib/tracktollywood/scraper';
import { buildComparison } from '@/lib/compare/buildComparison';
import { modeFromKey } from '@/lib/compare/mode';
import type { ComparisonMovie } from '@/lib/compare/types';
import { SLUG_PARAMS, MAX_COMPARE_MOVIES } from '@/lib/compare/urlParams';
import { buildComparisonPosterData } from '@/lib/poster/buildComparison';
import { ComparisonPoster, POSTER_WIDTH, computeComparisonPosterHeight, maxComparisonRowsForHeight } from '@/lib/poster/blocks';
import { buildComparisonPosterFilename } from '@/lib/poster/filename';
import type { ComparisonPosterFormat, PosterRowsMode } from '@/lib/poster/types';

export const dynamic = 'force-dynamic';
// axios (inside getMovieDetails) needs Node's http stack -- can't run on
// the edge runtime, same as every other TrackTollywood route (including
// the single-movie poster this one sits next to).
export const runtime = 'nodejs';

// Same local font/logo assets as app/api/social-poster/[slug]/route.tsx,
// loaded once per server process rather than duplicated per-request --
// see that route's own comment for why (Satori's fallback font is
// missing the ₹ glyph, and fetching either asset over the network mid-
// render isn't reliable).
const ASSET_DIR = path.join(process.cwd(), 'lib/poster/fonts');
const fontRegular = readFileSync(path.join(ASSET_DIR, 'NotoSans-Regular.woff'));
const fontBold = readFileSync(path.join(ASSET_DIR, 'NotoSans-Bold.woff'));

const logoBytes = readFileSync(path.join(process.cwd(), 'public/logo.png'));
const LOGO_SRC = `data:image/png;base64,${logoBytes.toString('base64')}`;

function parseRows(raw: string | null): PosterRowsMode {
  if (!raw || raw === 'all') return 'all';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 'all';
}

function parseFormat(raw: string | null): ComparisonPosterFormat {
  return raw === '1080x1350' || raw === '1080x1080' ? raw : 'auto';
}

// The FIXED canvas height for a non-auto format -- both fixed formats
// this poster supports are 1080px wide (POSTER_WIDTH never changes), so
// only the height varies.
function fixedHeightFor(format: ComparisonPosterFormat): number | null {
  if (format === '1080x1350') return 1350;
  if (format === '1080x1080') return 1080;
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const slugs = SLUG_PARAMS.map((p) => url.searchParams.get(p))
    .filter((s): s is string => !!s)
    .slice(0, MAX_COMPARE_MOVIES);
  if (slugs.length < 2) {
    return new Response(
      `Pass at least 2 movie slugs (?${SLUG_PARAMS[0]}=...&${SLUG_PARAMS[1]}=...), up to ${MAX_COMPARE_MOVIES}.`,
      { status: 400 }
    );
  }

  const settled = await Promise.allSettled(slugs.map((slug) => getMovieDetails(slug)));
  const movies: ComparisonMovie[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) movies.push({ slug: slugs[i], details: r.value });
  });
  if (movies.length < 2) {
    return new Response('Could not load at least 2 of the requested movies -- check the slugs and try again.', { status: 404 });
  }

  // Only used to validate the requested `mode` against what this exact
  // movie selection actually has (same fallback modeFromKey gives the
  // live /compare page) -- buildComparisonPosterData below re-derives
  // its own view model from `movies` rather than taking this one as an
  // argument, so the two calls can never disagree about what "this
  // movie selection's data" is.
  const previewVm = buildComparison(movies);
  const mode = modeFromKey(url.searchParams.get('mode'), previewVm.groups);

  const category = url.searchParams.get('category') ?? undefined;
  const align = url.searchParams.get('align') === 'date' ? 'date' : 'day';
  const metricsParam = url.searchParams.get('metrics');
  const metrics = metricsParam
    ? metricsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  const rows = parseRows(url.searchParams.get('rows'));
  const format = parseFormat(url.searchParams.get('format'));
  const watermark = url.searchParams.get('watermark') !== '0';

  const result = buildComparisonPosterData(movies, { mode, category, align, metrics, rows, format });
  if ('error' in result) {
    return new Response(result.error, { status: 404 });
  }

  let data = result.data;
  const fullRowCount = data.rows.length;
  const fixedH = fixedHeightFor(format);

  let height: number;
  if (fixedH != null) {
    // A fixed canvas can't grow to fit -- cap rows to exactly what fits
    // BEFORE rendering, so nothing is ever cut off mid-row. maxRows is
    // the exact inverse of the same height formula the auto format uses
    // (see lib/poster/blocks.tsx's maxComparisonRowsForHeight), never a
    // guess.
    height = fixedH;
    const hasSummary = data.summary.length > 0;
    const maxRows = maxComparisonRowsForHeight(height, data.movies.length, hasSummary);
    if (data.rows.length > maxRows) {
      data = { ...data, rows: data.rows.slice(0, Math.max(0, maxRows)) };
    }
  } else {
    height = computeComparisonPosterHeight(data.movies.length, data.summary.length > 0, data.rows.length);
  }

  const filename = buildComparisonPosterFilename(slugs, data.reportLine);

  return new ImageResponse(<ComparisonPoster data={data} logoSrc={LOGO_SRC} watermark={watermark} height={height} />, {
    width: POSTER_WIDTH,
    height,
    fonts: [
      { name: 'Noto Sans', data: fontRegular, style: 'normal', weight: 400 },
      { name: 'Noto Sans', data: fontBold, style: 'normal', weight: 700 }
    ],
    headers: {
      'Content-Disposition': `inline; filename="${filename}"`,
      'X-Poster-Row-Count': String(fullRowCount),
      'X-Poster-Rows-Shown': String(data.rows.length),
      'X-Poster-Movie-Count': String(data.movies.length)
    }
  });
}
