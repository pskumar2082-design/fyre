import path from 'path';
import { readFileSync } from 'fs';
import { ImageResponse } from 'next/og';
import { getMovieDetails } from '@/lib/tracktollywood/scraper';
import type { TTTable } from '@/lib/tracktollywood/types';

export const dynamic = 'force-dynamic';
// axios (inside getMovieDetails) needs Node's http stack -- this can't
// run on the edge runtime, same as every other TrackTollywood route.
export const runtime = 'nodejs';

const NAVY = '#14161C';
const GOLD = '#2F6FED'; // primary accent (site calls its blue "gold" -- see tailwind.config.js)
const GREEN = '#22C55E'; // goldDim -- "completed"/positive
const RED = '#EF4444'; // live/urgent
const CREAM = '#F6F4F0';
const BORDER = '#E7E5E0';
const TEXT = '#111827';
const TEXT_DIM = '#6B7280';
const TEXT_FAINT = '#9CA3AF';

// Satori (what next/og renders with) ships its own fallback font, but that
// fallback's Latin subset doesn't include the ₹ sign -- confirmed by
// actually rendering a card with it and getting a broken-glyph box in every
// gross figure. next/og's automatic "fetch whatever glyph is missing from
// Google Fonts at request time" fallback is what's *supposed* to catch
// this, but that dynamic fetch failed outright in testing (a 400 from
// Google's font API) -- not something to depend on for something that goes
// out to Vercel. So instead: a tiny (~10KB each) Noto Sans subset,
// generated once via Google Fonts' `text=` parameter to include exactly
// the characters this card needs (full ASCII + ₹ + a few punctuation
// marks) and committed here, loaded with zero network calls at request
// time.
const FONT_DIR = path.join(process.cwd(), 'lib/report-card/fonts');
const fontRegular = readFileSync(path.join(FONT_DIR, 'NotoSans-Regular.woff'));
const fontBold = readFileSync(path.join(FONT_DIR, 'NotoSans-Bold.woff'));

function badgeColor(state: string): string {
  if (state === 'live') return RED;
  if (state === 'final') return GREEN;
  return GOLD; // advance / upcoming
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function findLatestMatching(tables: TTTable[], test: (label: string) => boolean): TTTable | null {
  // Walks from the end because TrackTollywood appends newer snapshots
  // (later advance dates, later running days) to the end of the array --
  // confirmed against a live advance movie's table order (09-23, then
  // 09-24, then 09-25). "Latest" therefore means "last match", not first.
  for (let i = tables.length - 1; i >= 0; i--) {
    if (test(tables[i].label)) return tables[i];
  }
  return null;
}

function findLatest(tables: TTTable[], pattern: RegExp): TTTable | null {
  return findLatestMatching(tables, (label) => pattern.test(label));
}

// TrackTollywood renames its city breakdown once a movie actually releases
// -- "Advance <date> — Top Cities" pre-release becomes "Cumulative
// City-wise" after, and the old Advance-date tables stay in the array
// rather than disappearing. A plain /Top Cities/i search would keep
// matching the most recent Advance-labelled table even after release,
// which showed a week-old pre-release snapshot (one city, ₹0) instead of
// the movie's actual current numbers -- caught by rendering this against a
// real Day-5-live movie before shipping, not something a type-check would
// ever catch.
function pickCityTable(tables: TTTable[], state: string): TTTable | null {
  const isReleased = state === 'live' || state === 'final';
  if (isReleased) {
    const cumulative = tables.find((t) => t.label === 'Cumulative City-wise');
    if (cumulative) return cumulative;
    return findLatestMatching(tables, (l) => /Top Cities/i.test(l) && !/^Advance /i.test(l));
  }
  return findLatest(tables, /Top Cities/i);
}

// Picks a handful of columns to show rather than every column TrackTollywood
// happens to publish for that table -- some breakdown tables run to 6+
// columns (Gross/Net/Shows/Tickets/FF/Occ%), which would either overflow a
// fixed 1200px card or force illegibly small cells. Keeps the label column
// (always first) plus up to 3 more.
function pickColumns(headers: string[], max = 4): string[] {
  return headers.slice(0, max);
}

function MiniTable({ title, table, maxRows = 6 }: { title: string; table: TTTable | null; maxRows?: number }) {
  if (!table || table.rows.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 10 }}>{title}</div>
        <div style={{ display: 'flex', fontSize: 14, color: TEXT_FAINT }}>Not tracked yet.</div>
      </div>
    );
  }

  const cols = pickColumns(table.headers);
  const rows = table.rows.filter((r) => !r.__isTotal).slice(0, maxRows);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', background: NAVY, padding: '8px 14px' }}>
          {cols.map((c) => (
            <div key={c} style={{ display: 'flex', flex: 1, fontSize: 11, fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 }}>
              {c}
            </div>
          ))}
        </div>
        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              padding: '9px 14px',
              background: i % 2 === 0 ? '#FFFFFF' : CREAM,
              borderTop: `1px solid ${BORDER}`
            }}
          >
            {cols.map((c) => (
              <div key={c} style={{ display: 'flex', flex: 1, fontSize: 13, color: TEXT, fontWeight: c === cols[0] ? 600 : 400 }}>
                {row[c] || '—'}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  let details;
  try {
    details = await getMovieDetails(params.slug);
  } catch {
    details = null;
  }
  if (!details) {
    return new Response(`TrackTollywood has no movie at slug "${params.slug}"`, { status: 404 });
  }

  const dayWise = findLatest(details.tables, /^Day-wise Collection$/);
  const cityTable = pickCityTable(details.tables, details.state);

  const dateLabel = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // Satori/resvg (what next/og renders images with) can't decode WebP --
  // TrackTollywood's lazy-loaded posters are served via a Smush-plugin
  // WebP path, but the same asset also exists at the plain pre-Smush .jpg
  // path (what its own <noscript> fallback uses). Swap to that if the URL
  // matches the expected pattern; otherwise skip the poster entirely
  // rather than risk another unrenderable-image failure.
  const posterJpg = details.poster
    ?.replace('/wp-content/smush-webp/', '/wp-content/uploads/')
    ?.replace(/\.jpg\.webp$/, '.jpg') ?? null;
  const posterUrl = posterJpg && posterJpg !== details.poster ? posterJpg : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          fontFamily: 'Noto Sans'
        }}
      >
        {/* TOP BANNER */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '26px 48px',
            background: NAVY
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', fontSize: 30 }}>🔥</div>
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 800, color: '#FFFFFF' }}>fyre</div>
            <div style={{ display: 'flex', width: 1, height: 24, background: '#333844' }} />
            <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#9CA3AF' }}>
              Daily Box Office Report
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 16, fontWeight: 600, color: '#FFFFFF' }}>{dateLabel}</div>
        </div>

        {/* BODY */}
        <div style={{ display: 'flex', flex: 1, padding: '40px 48px', gap: 40 }}>
          {/* HERO / LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', width: 320 }}>
            {posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterUrl}
                width={200}
                height={266}
                style={{ borderRadius: 16, objectFit: 'cover', border: `1px solid ${BORDER}` }}
              />
            )}
            <div
              style={{
                display: 'flex',
                marginTop: 16,
                alignSelf: 'flex-start',
                padding: '6px 14px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: '#FFFFFF',
                background: badgeColor(details.state)
              }}
            >
              {details.badgeText || details.state}
            </div>
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: TEXT, marginTop: 14, lineHeight: 1.15 }}>
              {truncate(details.title, 26)}
            </div>
            {details.headlineGross && (
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
                <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, color: GOLD, lineHeight: 1 }}>
                  {details.headlineGross}
                </div>
                {details.headlineLabel && (
                  <div style={{ display: 'flex', fontSize: 13, fontWeight: 600, color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 }}>
                    {details.headlineLabel}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* TABLES / RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 28 }}>
            <MiniTable title={dayWise?.label ?? 'Day-wise Collection'} table={dayWise} maxRows={7} />
            <MiniTable title={cityTable?.label ?? 'Top Cities'} table={cityTable} maxRows={5} />
          </div>
        </div>

        {/* FOOTER */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 48px',
            background: CREAM,
            borderTop: `1px solid ${BORDER}`
          }}
        >
          <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: TEXT }}>fyre.co.in</div>
          <div style={{ display: 'flex', fontSize: 12, color: TEXT_FAINT }}>
            {details.metaUpdatedText || 'Source: TrackTollywood'}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
      fonts: [
        { name: 'Noto Sans', data: fontRegular, style: 'normal', weight: 400 },
        { name: 'Noto Sans', data: fontBold, style: 'normal', weight: 700 }
      ]
    }
  );
}
