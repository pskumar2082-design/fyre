import type { PosterData } from './types';
import type { ComparisonPosterData } from './types';

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
// The 4th per-movie comparison color -- tailwind.config.js's own
// `indigo` token. Only used by the comparison poster below (a single-
// movie poster never needs more than the existing GOLD/GREEN/RED/AMBER
// set), kept alongside them rather than redefined locally so both
// posters agree on the exact same hex if either is ever re-themed.
const INDIGO = '#6C7BF0';
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

// =======================================================================
// Comparison poster (Movie vs Movie) -- reuses PosterHeader/
// PosterWatermark/PosterFooter exactly as-is (per the task's own "reuse
// existing blocks" instruction); everything below is new, comparison-
// shaped blocks for up to 4 movies at once. Movie identity (color) uses
// the SAME 4-token palette (gold/green/amber/indigo) and order as
// components/compare/movieColors.ts's web version, so a movie is always
// the same color on the live page and on a poster of it.
// =======================================================================
const MOVIE_COLORS = [GOLD, GREEN, AMBER, INDIGO];
function movieColor(i: number): string {
  return MOVIE_COLORS[i % MOVIE_COLORS.length];
}

const CMP_MOVIES_H = 172;
const CMP_REPORT_LINE_H = 60;
const CMP_SUMMARY_LABEL_H = 30;
const CMP_SUMMARY_ROW_H = 28;
const CMP_SUMMARY_PAD = 32; // top+bottom padding inside each stat card
const CMP_TABLE_HEAD_H = 76; // metric-group row + per-movie color-dot row
const CMP_TABLE_ROW_H = 52;
const CMP_TABLE_OUTER_PAD = 4;

// Exact same "sum of fixed/derived block heights, one SECTION_GAP after
// each block that's actually rendered" approach as computePosterHeight()
// above -- never a guess, always derived from the SAME counts
// (movie count, whether a summary/table is present, row count) the
// ComparisonPoster component below renders from. The API route computes
// this BEFORE rendering (same contract as the single-movie poster) and
// is responsible for capping `rowCount` so a fixed 1080x1350/1080x1080
// format never overflows -- see app/api/social-poster/compare/route.ts.
export function computeComparisonPosterHeight(movieCount: number, hasSummary: boolean, rowCount: number): number {
  const summaryH = hasSummary ? CMP_SUMMARY_PAD + CMP_SUMMARY_LABEL_H + movieCount * CMP_SUMMARY_ROW_H : 0;
  const hasTable = rowCount > 0;
  const tableH = hasTable ? CMP_TABLE_HEAD_H + rowCount * CMP_TABLE_ROW_H + CMP_TABLE_OUTER_PAD : 0;

  const blocks = [HEADER_H, CMP_MOVIES_H, CMP_REPORT_LINE_H, summaryH, tableH].filter((h) => h > 0);
  const gaps = SECTION_GAP * blocks.length; // one gap after each rendered block, same as the flex spacer before the footer below
  return Math.round(OUTER_PAD * 2 + blocks.reduce((a, b) => a + b, 0) + gaps + FOOTER_H);
}

// How many table rows fit in a FIXED canvas height (1080x1350/1080x1080)
// without the table growing past the bottom -- the inverse of
// computeComparisonPosterHeight's own table-height term. Used by the API
// route to cap rows BEFORE rendering for a fixed format, so nothing is
// ever silently cut off mid-row; 'auto' format never needs this (the
// canvas grows to fit instead).
export function maxComparisonRowsForHeight(height: number, movieCount: number, hasSummary: boolean): number {
  const summaryH = hasSummary ? CMP_SUMMARY_PAD + CMP_SUMMARY_LABEL_H + movieCount * CMP_SUMMARY_ROW_H : 0;
  const nonTableBlocks = [HEADER_H, CMP_MOVIES_H, CMP_REPORT_LINE_H, summaryH].filter((h) => h > 0);
  // +1 accounts for the table's own gap-after (present once the table
  // itself renders) on top of the gaps already following the blocks above.
  const nonTableH = OUTER_PAD * 2 + nonTableBlocks.reduce((a, b) => a + b, 0) + SECTION_GAP * (nonTableBlocks.length + 1) + FOOTER_H;
  const available = height - nonTableH - CMP_TABLE_HEAD_H - CMP_TABLE_OUTER_PAD;
  return Math.max(0, Math.floor(available / CMP_TABLE_ROW_H));
}

// ---------------------------------------------------------------------
// ComparisonPosterMovies -- up to 4 movie cards side by side, each with
// its own color accent (matching that movie's color everywhere else on
// this poster), a small poster thumbnail when available, its title and
// its own real release date/text (never a made-up one).
// ---------------------------------------------------------------------
function ComparisonPosterMovies({ data }: { data: ComparisonPosterData }) {
  return (
    <div style={{ display: 'flex', gap: 14, height: CMP_MOVIES_H - SECTION_GAP }}>
      {data.movies.map((m, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flex: 1,
            gap: 12,
            alignItems: 'center',
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderTop: `3px solid ${movieColor(i)}`,
            borderRadius: 14,
            padding: '14px 16px',
            overflow: 'hidden'
          }}
        >
          {m.posterImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.posterImageUrl}
              width={56}
              height={78}
              style={{ objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
            />
          ) : (
            <div style={{ display: 'flex', width: 56, height: 78, borderRadius: 8, background: NAVY_ALT, flexShrink: 0 }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', width: 10, height: 10, borderRadius: 999, background: movieColor(i), marginBottom: 8 }} />
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: WHITE, lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {truncate(m.title, 20)}
            </div>
            {m.releaseText && (
              <div style={{ display: 'flex', fontSize: 12, color: TEXT_FAINT, marginTop: 4, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {truncate(m.releaseText, 24)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// ComparisonPosterReportLine -- which report this is (e.g. "Day-wise
// Collection — Day 1 vs Day 1"), the time-alignment note when relevant,
// and a plain-language freshness note -- the comparison-poster
// equivalent of PosterMetadata's report line for a single movie.
// ---------------------------------------------------------------------
function ComparisonPosterReportLine({ data }: { data: ComparisonPosterData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: CMP_REPORT_LINE_H - SECTION_GAP }}>
      <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: GOLD_TINT_TEXT }}>{truncate(data.reportLine, 60)}</div>
      <div style={{ display: 'flex', fontSize: 13, color: TEXT_FAINT, marginTop: 6 }}>
        {data.alignmentNote ? `${data.alignmentNote} · Most recently synced` : 'Most recently synced'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// ComparisonPosterSummary -- up to 3 headline stats (the same union
// lib/compare/buildComparison.ts's own stats union produced), each shown
// as every movie's own value on its own colored-dot line -- never a
// single "winner" number, matching the rest of the comparison feature's
// neutral-comparison rule. Renders nothing if none are available.
//
// Sized in fixed PIXELS, not flex ratios -- same reasoning as
// comparisonColumnWidths()/PosterTable below: a flex:1 (or even
// flex:1+minWidth:0) TEXT-bearing leaf inside another flex:1 row, next to
// a sibling with no explicit width, is exactly the shape that once made
// every label/title/value in this block render *and* the shape that,
// even after adding minWidth:0 fixed the overlap, went on to render
// blank instead (Satori/Yoga resolving an ambiguous flex-basis to 0
// width rather than to content size). Calibrating an explicit width per
// card/title/value slot up front, the way PosterTable's own columns
// already do, sidesteps that ambiguity entirely instead of chasing it.
// ---------------------------------------------------------------------
const CMP_SUMMARY_GAP = 16;
const CMP_SUMMARY_CARD_PAD_X = 20; // matches padding: '16px 20px' below

function comparisonSummaryWidths(cardCount: number): { cardW: number; titleW: number; valueW: number } {
  const contentW = POSTER_WIDTH - 56 * 2; // same page padding every other top-level block renders within
  const cardW = Math.floor((contentW - CMP_SUMMARY_GAP * (cardCount - 1)) / Math.max(1, cardCount));
  const innerW = cardW - CMP_SUMMARY_CARD_PAD_X * 2;
  const dotBlockW = 8 + 8; // dot width + its marginRight
  const valueMarginLeft = 8;
  const available = Math.max(40, innerW - dotBlockW - valueMarginLeft);
  const valueW = Math.max(56, Math.floor(available * 0.42));
  const titleW = Math.max(32, available - valueW);
  return { cardW, titleW, valueW };
}

function ComparisonPosterSummary({ data }: { data: ComparisonPosterData }) {
  if (data.summary.length === 0) return <div style={{ display: 'flex', height: 0 }} />;
  const rowH = CMP_SUMMARY_ROW_H;
  const { cardW, titleW, valueW } = comparisonSummaryWidths(data.summary.length);
  const labelW = cardW - CMP_SUMMARY_CARD_PAD_X * 2;
  return (
    <div style={{ display: 'flex', gap: CMP_SUMMARY_GAP, height: CMP_SUMMARY_PAD + CMP_SUMMARY_LABEL_H + data.movies.length * rowH - SECTION_GAP }}>
      {data.summary.map((s) => (
        <div
          key={s.label}
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: cardW,
            flexShrink: 0,
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 16,
            padding: '16px 20px'
          }}
        >
          <div
            style={{
              display: 'flex',
              width: labelW,
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 700,
              color: TEXT_FAINT,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              marginBottom: 4,
              overflow: 'hidden',
              whiteSpace: 'nowrap'
            }}
          >
            {truncate(s.label, maxCharsFor(labelW))}
          </div>
          {data.movies.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', height: rowH }}>
              <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 999, background: movieColor(i), marginRight: 8, flexShrink: 0 }} />
              <div style={{ display: 'flex', width: titleW, flexShrink: 0, fontSize: 14, color: TEXT_DIM, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {truncate(m.title, maxCharsFor(titleW))}
              </div>
              <div
                style={{
                  display: 'flex',
                  width: valueW,
                  flexShrink: 0,
                  justifyContent: 'flex-end',
                  fontSize: 16,
                  fontWeight: 700,
                  color: s.values[i] != null ? WHITE : TEXT_FAINT,
                  marginLeft: 8,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}
              >
                {truncate(s.values[i] ?? 'N/A', maxCharsFor(valueW))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// ComparisonPosterTable -- the merged breakdown: one metric group per
// column (spanning that many movie sub-columns), a small color-dot row
// identifying which sub-column belongs to which movie, then the rows
// themselves (state/day/language/... names, matched across movies by
// lib/compare/buildComparison.ts's buildComparedTable -- see
// lib/poster/buildComparison.ts). Column widths are budgeted across
// (name column + metric-columns × movie-count) sub-slots so this never
// overflows POSTER_WIDTH regardless of how many metrics/movies are
// selected; a narrow sub-column just truncates its value with an
// ellipsis (via maxCharsFor) rather than clipping it outright.
// ---------------------------------------------------------------------
function comparisonColumnWidths(nameColumn: string, columns: string[], movieCount: number): { nameW: number; colW: number } {
  const nameWeight = 2;
  const subWeight = 1;
  const totalWeight = nameWeight + columns.length * movieCount * subWeight;
  const nameW = Math.floor((nameWeight / totalWeight) * TABLE_ROW_CONTENT_W);
  const remaining = TABLE_ROW_CONTENT_W - nameW;
  const totalSubSlots = Math.max(1, columns.length * movieCount);
  const colW = Math.floor(remaining / totalSubSlots);
  return { nameW, colW };
}

function ComparisonPosterTable({ data }: { data: ComparisonPosterData }) {
  const movieCount = data.movies.length;
  const { nameW, colW } = comparisonColumnWidths(data.nameColumn, data.columns, movieCount);
  const groupW = colW * movieCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      {/* Header row 1 -- metric group names, each spanning its movies' sub-columns */}
      <div style={{ display: 'flex', background: NAVY_ALT, height: CMP_TABLE_HEAD_H / 2, alignItems: 'center', padding: '0 20px' }}>
        <div style={{ display: 'flex', width: nameW, flexShrink: 0 }} />
        {data.columns.map((c) => (
          <div
            key={c}
            style={{
              display: 'flex',
              width: groupW,
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 700,
              color: TEXT_DIM,
              textTransform: 'uppercase',
              letterSpacing: 1,
              justifyContent: 'center',
              overflow: 'hidden',
              whiteSpace: 'nowrap'
            }}
          >
            {truncate(c, Math.floor(groupW / 7))}
          </div>
        ))}
      </div>
      {/* Header row 2 -- one color dot per movie, under each metric group */}
      <div
        style={{
          display: 'flex',
          background: NAVY_ALT,
          height: CMP_TABLE_HEAD_H / 2,
          alignItems: 'center',
          padding: '0 20px',
          borderBottom: `2px solid ${GOLD}`
        }}
      >
        <div style={{ display: 'flex', width: nameW, flexShrink: 0, fontSize: 11, fontWeight: 700, color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: 1 }}>
          {truncate(data.nameColumn, maxCharsFor(nameW))}
        </div>
        {data.columns.map((c) =>
          data.movies.map((_, mi) => (
            <div key={`${c}-${mi}`} style={{ display: 'flex', width: colW, flexShrink: 0, justifyContent: 'center' }}>
              <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 999, background: movieColor(mi) }} />
            </div>
          ))
        )}
      </div>
      {data.rows.map((row, i) => (
        <div
          key={row.name}
          style={{
            display: 'flex',
            height: CMP_TABLE_ROW_H,
            alignItems: 'center',
            padding: '0 20px',
            background: i % 2 === 1 ? 'rgba(255,255,255,0.025)' : 'transparent',
            borderTop: `1px solid ${BORDER}`
          }}
        >
          <div style={{ display: 'flex', width: nameW, flexShrink: 0, fontSize: 15, fontWeight: 600, color: WHITE, overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {truncate(row.name, maxCharsFor(nameW))}
          </div>
          {data.columns.map((c) =>
            data.movies.map((_, mi) => {
              const value = row.valuesByColumn[c]?.[mi];
              const money = isMoneyColumn(c);
              return (
                <div
                  key={`${c}-${mi}`}
                  style={{
                    display: 'flex',
                    width: colW,
                    flexShrink: 0,
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: money ? 700 : 500,
                    color: value == null ? TEXT_FAINT : money ? GOLD_TINT_TEXT : TEXT_DIM,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {value != null ? truncate(value, maxCharsFor(colW)) : 'N/A'}
                </div>
              );
            })
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// ComparisonPoster -- composes the blocks above (plus the reused
// PosterHeader/PosterWatermark/PosterFooter) into the full page Satori
// renders for a comparison. `height` must equal
// computeComparisonPosterHeight(data.movies.length, data.summary.length>0,
// data.rows.length) -- the caller (the API route) owns that, same
// contract as the single-movie SocialPoster above.
// ---------------------------------------------------------------------
export function ComparisonPoster({
  data,
  logoSrc,
  watermark,
  height
}: {
  data: ComparisonPosterData;
  logoSrc: string;
  watermark: boolean;
  height: number;
}) {
  const hasSummary = data.summary.length > 0;
  const hasTable = data.rows.length > 0;

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
        <ComparisonPosterMovies data={data} />
        <div style={{ display: 'flex', height: SECTION_GAP }} />
        <ComparisonPosterReportLine data={data} />
        {hasSummary && (
          <>
            <div style={{ display: 'flex', height: SECTION_GAP }} />
            <ComparisonPosterSummary data={data} />
          </>
        )}
        {hasTable && (
          <>
            <div style={{ display: 'flex', height: SECTION_GAP }} />
            <ComparisonPosterTable data={data} />
          </>
        )}
        <div style={{ display: 'flex', flex: 1 }} />
        <PosterFooter />
      </div>
    </div>
  );
}
