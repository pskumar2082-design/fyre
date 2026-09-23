import type { PosterData } from './types';

// Satori JSX building blocks for the Social Poster (see
// app/api/social-poster/[slug]/route.tsx, which composes these with
// next/og's ImageResponse). Every element needs an explicit `display`
// (Satori/Yoga's layout engine, not a browser) -- see the repo's own past
// notes on this in the git history for the bugs that surfaced from
// getting it wrong (missing glyphs, unsupported CSS values, unsupported
// image formats), all fixed by testing against real rendered PNGs rather
// than assuming Tailwind-like behavior "just works" here.
//
// Structural inspiration only (information hierarchy: logo+domain header,
// title, metadata line, summary stats, breakdown table, watermark,
// footer) -- every color, font, spacing and asset below is fyre's own:
// its real navy/blue/green/red brand tokens (tailwind.config.js) and its
// real logo (public/logo.png), not any other site's design.

export const POSTER_WIDTH = 1080;

const NAVY = '#14161C';
const NAVY_ALT = '#1D2029';
const CARD_BG = 'rgba(255,255,255,0.04)';
const CARD_BORDER = 'rgba(255,255,255,0.08)';
const GOLD = '#2F6FED'; // fyre's primary accent (tailwind.config.js calls it "gold"; it's blue)
const GOLD_TINT_BG = 'rgba(47,111,237,0.16)';
const GOLD_TINT_TEXT = '#8FB4FF';
const GREEN = '#22C55E';
const RED = '#EF4444';
const AMBER = '#F59E0B';
const WHITE = '#FFFFFF';
const TEXT_DIM = 'rgba(255,255,255,0.62)';
const TEXT_FAINT = 'rgba(255,255,255,0.38)';
const BORDER = 'rgba(255,255,255,0.10)';

// --- Layout constants the height calculator below and the row renderer
// both depend on -- every table row is exactly ROW_H tall (see the
// truncate() calls in PosterTable), which is what makes computing the
// canvas height from a row COUNT alone valid rather than a guess.
const HEADER_H = 104;
const TITLE_BLOCK_H = 190; // up to 2 title lines + report line + updated line
const SUMMARY_H = 156;
const TABLE_HEAD_H = 52;
const TABLE_ROW_H = 58;
const TABLE_OUTER_PAD = 4; // the table card's own top/bottom border
const FOOTER_H = 88;
const SECTION_GAP = 28;
const OUTER_PAD = 56; // page padding, top and bottom each

export function computePosterHeight(rowCount: number): number {
  const tableH = TABLE_HEAD_H + rowCount * TABLE_ROW_H + TABLE_OUTER_PAD;
  const gaps = SECTION_GAP * 3;
  return Math.round(OUTER_PAD * 2 + HEADER_H + TITLE_BLOCK_H + SUMMARY_H + tableH + gaps + FOOTER_H);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// truncate() cuts by character count, but a column's actual pixel width
// depends on how many columns the table has (columnWidths() below) --
// a fixed character limit calibrated against a 6-column table's wide name
// column silently overflowed (and got cut off mid-character by the cell's
// own overflow:hidden, with no visible "…") on tables with more columns,
// like Time Slots' 8. maxCharsFor() scales the limit with the column's
// real width instead, using a conservative measured ratio for this font
// (Noto Sans, the weights this poster actually loads) so text always
// finishes inside its column with a visible ellipsis rather than getting
// silently clipped by the layout engine.
const AVG_CHAR_PX = 8.5;
function maxCharsFor(widthPx: number): number {
  return Math.max(4, Math.floor(widthPx / AVG_CHAR_PX));
}

// PosterTable columns are sized in fixed PIXELS (not flex ratios) so every
// poster -- always rendered at the same fixed POSTER_WIDTH, never in a
// responsive viewport -- gets a predictable, calibrated width per column.
//
// Some TrackTollywood tables (Top Cities, Cumulative City-wise) lead with
// their own rank column ("#"), which pushes the actual name column
// (City/State/Language/Format) to index 1 instead of 0. Caught during
// visual QA: treating column 0 as "the name column" unconditionally made
// City silently fall through to the generic dim/right-aligned/narrow cell
// style meant for plain data columns, for every ranked report -- readable
// only by accident, and any name close to that narrow column's width
// would render partly cut off. nameColumnIndex() finds the real name
// column by skipping a leading rank column if there is one, so the rank
// number and the name it belongs to are always styled distinctly.
function isRankColumn(header: string): boolean {
  return header.trim() === '#';
}
function nameColumnIndex(columns: string[]): number {
  const i = columns.findIndex((h) => !isRankColumn(h));
  return i === -1 ? 0 : i;
}

const TABLE_ROW_CONTENT_W = POSTER_WIDTH - 56 * 2 - 1 * 2 - 20 * 2; // page padding, table border, row padding
function columnWidths(columns: string[]): number[] {
  const nameIdx = nameColumnIndex(columns);
  const weights = columns.map((h, i) => {
    if (isRankColumn(h)) return 0.6;
    if (i === nameIdx) return 1.6;
    return 1;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.floor((w / total) * TABLE_ROW_CONTENT_W));
  // give any leftover rounding pixels to the last column rather than
  // letting the row fall a few px short of the table's own width.
  const used = widths.reduce((a, b) => a + b, 0);
  widths[widths.length - 1] += TABLE_ROW_CONTENT_W - used;
  return widths;
}

function isMoneyColumn(header: string): boolean {
  return /gross|collection|coll\./i.test(header);
}
function isPercentColumn(header: string): boolean {
  return header.trim() === '%' || /share/i.test(header);
}
function isOccupancyColumn(header: string): boolean {
  return /occupancy/i.test(header);
}
function isDataColumn(header: string): boolean {
  return /ticket|show|screen|change/i.test(header);
}

function occupancyColor(text: string): string {
  const n = Number(text.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return TEXT_DIM;
  if (n < 25) return RED;
  if (n < 55) return AMBER;
  return GREEN;
}

// ---------------------------------------------------------------------
// PosterWatermark -- tiled, rotated, low-opacity fyre logo behind every
// other layer, so a cropped or re-shared copy of this image still traces
// back to fyre. Distributed as a loose grid rather than one big centered
// mark, per the brief's "distributed naturally" / "should never compete
// with the actual data" requirement.
// ---------------------------------------------------------------------
export function PosterWatermark({ logoSrc, width, height, opacity = 0.05 }: { logoSrc: string; width: number; height: number; opacity?: number }) {
  const tileW = 220;
  const tileH = 92;
  const cols = Math.ceil(width / tileW) + 1;
  const rows = Math.ceil(height / tileH) + 1;
  const tiles = Array.from({ length: cols * rows });

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width, height, display: 'flex', flexWrap: 'wrap', overflow: 'hidden' }}>
      {tiles.map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        // stagger alternate rows so the tiled grid doesn't read as
        // obviously repeating columns
        const offsetX = row % 2 === 0 ? 0 : tileW / 2;
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              position: 'absolute',
              left: col * tileW + offsetX - tileW / 2,
              top: row * tileH - tileH / 2,
              width: tileW,
              height: tileH,
              alignItems: 'center',
              justifyContent: 'center',
              opacity,
              transform: 'rotate(-14deg)'
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} width={132} height={54} style={{ objectFit: 'contain' }} />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// PosterHeader -- fyre's real logo asset (not a re-typed wordmark) on the
// left, the domain on the right.
// ---------------------------------------------------------------------
export function PosterHeader({ logoSrc }: { logoSrc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: HEADER_H - 24 }}>
      {/* logo.png's own aspect ratio (584x240) -- scaled down, height fixed */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} width={116} height={48} style={{ objectFit: 'contain' }} />
      <div style={{ display: 'flex', fontSize: 18, fontWeight: 600, color: TEXT_DIM, letterSpacing: 0.5 }}>fyre.co.in</div>
    </div>
  );
}

// ---------------------------------------------------------------------
// PosterMetadata -- movie title (up to 2 lines), the selected report
// line, and a plain-language freshness note. Deliberately does not name
// the upstream data source anywhere the poster displays it (fyre's
// tracking source is internal plumbing, not user-facing -- same reason
// the site's own URLs were moved off /tracktollywood/[slug] to
// /movie/[slug] earlier).
// ---------------------------------------------------------------------
export function PosterMetadata({ data }: { data: PosterData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: TITLE_BLOCK_H - SECTION_GAP }}>
      {data.badgeText && (
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            padding: '6px 14px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1,
            color: WHITE,
            background: GOLD,
            marginBottom: 14
          }}
        >
          {data.badgeText}
        </div>
      )}
      <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, color: WHITE, lineHeight: 1.15 }}>
        {truncate(data.movieTitle, 42)}
      </div>
      <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, color: GOLD_TINT_TEXT, marginTop: 8 }}>
        {truncate(data.reportLine, 64)}
      </div>
      {/* A plain-language freshness note instead of a literal timestamp --
          exact generated/updated times read as stale within minutes on a
          poster meant to be shared, and needlessly precise for what this
          line is actually for (reassuring the viewer the numbers are
          current). data.generatedDateText / updatedText are still on
          PosterData for anything that wants the literal values. */}
      <div style={{ display: 'flex', fontSize: 14, color: TEXT_FAINT, marginTop: 10 }}>
        Most recently synced
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// PosterSummary -- up to three headline stats (Gross / Tickets / Shows),
// each derived from the exact table shown below (see
// lib/poster/build.ts's buildSummary) rather than a separate figure.
// Renders nothing if none are available, rather than showing empty cards.
// ---------------------------------------------------------------------
export function PosterSummary({ data }: { data: PosterData }) {
  if (data.summary.length === 0) return <div style={{ display: 'flex', height: 0 }} />;
  return (
    <div style={{ display: 'flex', gap: 16, height: SUMMARY_H - SECTION_GAP }}>
      {data.summary.map((s) => (
        <div
          key={s.label}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 16,
            padding: '18px 22px',
            justifyContent: 'center'
          }}
        >
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: WHITE }}>{s.value}</div>
          <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, color: TEXT_FAINT, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 6 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// PosterTable -- the breakdown itself. Every row is a fixed TABLE_ROW_H
// tall (long labels are truncated, not wrapped) so computePosterHeight's
// row-count-based math stays exact regardless of content.
// ---------------------------------------------------------------------
export function PosterTable({ data }: { data: PosterData }) {
  const widths = columnWidths(data.columns);
  const nameIdx = nameColumnIndex(data.columns);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', background: NAVY_ALT, height: TABLE_HEAD_H, alignItems: 'center', padding: '0 20px', borderBottom: `2px solid ${GOLD}` }}>
        {data.columns.map((h, i) => (
          <div
            key={h}
            style={{
              display: 'flex',
              width: widths[i],
              flexShrink: 0,
              fontSize: 12,
              fontWeight: 700,
              color: TEXT_DIM,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              justifyContent: isRankColumn(h) ? 'center' : i === nameIdx ? 'flex-start' : 'flex-end'
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {data.rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            height: TABLE_ROW_H,
            alignItems: 'center',
            padding: '0 20px',
            background: i % 2 === 1 ? 'rgba(255,255,255,0.025)' : 'transparent',
            borderTop: `1px solid ${BORDER}`
          }}
        >
          {data.columns.map((h, ci) => {
            const value = row[h] ?? '—';
            const base = { display: 'flex', width: widths[ci], flexShrink: 0, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden' } as const;
            if (isRankColumn(h)) {
              return (
                <div key={h} style={{ ...base, color: TEXT_FAINT, fontWeight: 600, justifyContent: 'center' }}>
                  {value}
                </div>
              );
            }
            if (ci === nameIdx) {
              return (
                <div key={h} style={{ ...base, fontWeight: 600, color: WHITE, justifyContent: 'flex-start' }}>
                  {truncate(value, maxCharsFor(widths[ci]))}
                </div>
              );
            }
            if (isMoneyColumn(h)) {
              return (
                <div key={h} style={{ ...base, fontWeight: 700, color: GOLD_TINT_TEXT, justifyContent: 'flex-end' }}>
                  {value}
                </div>
              );
            }
            if (isPercentColumn(h)) {
              return (
                <div key={h} style={{ ...base, justifyContent: 'flex-end' }}>
                  <div
                    style={{
                      display: 'flex',
                      background: GOLD_TINT_BG,
                      color: GOLD_TINT_TEXT,
                      fontWeight: 700,
                      fontSize: 14,
                      padding: '4px 12px',
                      borderRadius: 999
                    }}
                  >
                    {value}
                  </div>
                </div>
              );
            }
            if (isOccupancyColumn(h)) {
              return (
                <div key={h} style={{ ...base, fontWeight: 700, color: occupancyColor(value), justifyContent: 'flex-end' }}>
                  {value}
                </div>
              );
            }
            if (isDataColumn(h)) {
              return (
                <div key={h} style={{ ...base, color: TEXT_DIM, justifyContent: 'flex-end' }}>
                  {value}
                </div>
              );
            }
            return (
              <div key={h} style={{ ...base, color: TEXT_DIM, justifyContent: 'flex-end' }}>
                {truncate(value, maxCharsFor(widths[ci]))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// PosterFooter -- domain + an honest tagline. No invented social handles:
// this project has none on record, and a fabricated @handle is worse
// than no footer link at all.
// ---------------------------------------------------------------------
export function PosterFooter() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: FOOTER_H - SECTION_GAP,
        borderTop: `1px solid ${BORDER}`,
        paddingTop: 22
      }}
    >
      <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: WHITE }}>fyre.co.in</div>
      <div style={{ display: 'flex', fontSize: 13, color: TEXT_FAINT }}>Fyre Box Office Analytics</div>
    </div>
  );
}

// ---------------------------------------------------------------------
// SocialPoster -- composes the blocks above into the full page Satori
// renders. `height` must equal computePosterHeight(data.rows.length) --
// the caller (the API route) owns that so this component stays a pure
// function of its props.
// ---------------------------------------------------------------------
export function SocialPoster({
  data,
  logoSrc,
  watermark,
  height
}: {
  data: PosterData;
  logoSrc: string;
  watermark: boolean;
  height: number;
}) {
  return (
    <div
      style={{
        width: POSTER_WIDTH,
        height,
        display: 'flex',
        flexDirection: 'column',
        background: NAVY,
        fontFamily: 'Noto Sans',
        position: 'relative',
        padding: `${OUTER_PAD}px 56px`
      }}
    >
      {watermark && <PosterWatermark logoSrc={logoSrc} width={POSTER_WIDTH} height={height} />}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', flex: 1 }}>
        <PosterHeader logoSrc={logoSrc} />
        <div style={{ display: 'flex', height: SECTION_GAP }} />
        <PosterMetadata data={data} />
        <div style={{ display: 'flex', height: SECTION_GAP }} />
        <PosterSummary data={data} />
        <div style={{ display: 'flex', height: SECTION_GAP }} />
        <PosterTable data={data} />
        <div style={{ display: 'flex', flex: 1 }} />
        <PosterFooter />
      </div>
    </div>
  );
}
