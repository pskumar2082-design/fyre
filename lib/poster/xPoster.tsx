// X-ready poster for Fyre Analytics: "Movie Report" (one movie) and
// "Movie Comparison" (Movie A vs Movie B). It renders a Comparison view
// model from lib/analytics/compare.ts exactly as returned -- the same
// numbers the Movie Comparison page shows. No calculation happens here;
// only formatting and layout. Territory: India (INR), USA · Indian-language
// screenings (USD), or both side by side (TerritoryPoster) -- currencies
// are never added together.
import { formatMetric } from '../analytics/format';
import { METRIC_LABELS } from '../analytics/metrics';
import type { Comparison, Currency, MetricKey, Metrics } from '../analytics/types';

export const X_WIDTH = 1080;

const NAVY = '#14161C';
const CARD = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.10)';
const WHITE = '#FFFFFF';
const DIM = 'rgba(255,255,255,0.62)';
const FAINT = 'rgba(255,255,255,0.40)';
const ACCENT = '#2F6FED';
const ACCENT_TINT = 'rgba(47,111,237,0.16)';
const ACCENT_TEXT = '#8FB4FF';
const COLORS = ['#2F6FED', '#22C55E'];

export type XPosterOptions = {
  metric: MetricKey;
  chart: boolean;
  summaryMetrics: MetricKey[];
  // 'natural' (default): the canvas grows to fit. 'x45': the fixed X 4:5
  // canvas (1080 x 1350) -- tighter spacing, fewer breakdown rows, same
  // content and font sizes (see fitToHeight / fitTerritoryToHeight).
  layout?: 'natural' | 'x45';
};

export const X45_HEIGHT = 1350;
const PAD = 56;

// Layout heights (px) -- the route computes the canvas height from these.
type Lay = {
  header: number;
  postersCmp: number;
  postersReport: number;
  cmpPosterW: number;
  cmpPosterH: number;
  repPosterW: number;
  repPosterH: number;
  vsTop: number;
  context: number;
  summaryRow: number;
  gap: number;
  tableTitle: number;
  tableHead: number;
  tableRow: number;
  chart: number;
  footer: number;
  colHead: number;
};
const NATURAL: Lay = { header: 84, postersCmp: 440, postersReport: 330, cmpPosterW: 220, cmpPosterH: 300, repPosterW: 200, repPosterH: 300, vsTop: 118, context: 76, summaryRow: 70, gap: 26, tableTitle: 44, tableHead: 50, tableRow: 54, chart: 300, footer: 70, colHead: 76 };
const X45: Lay = { header: 72, postersCmp: 350, postersReport: 250, cmpPosterW: 170, cmpPosterH: 232, repPosterW: 160, repPosterH: 240, vsTop: 76, context: 64, summaryRow: 58, gap: 18, tableTitle: 40, tableHead: 44, tableRow: 46, chart: 230, footer: 58, colHead: 68 };
export function layoutFor(o: Pick<XPosterOptions, 'layout'>): Lay {
  return o.layout === 'x45' ? X45 : NATURAL;
}

export function xPosterHeight(c: Comparison, o: XPosterOptions): number {
  const l = layoutFor(o);
  const report = c.movies.length === 1;
  const summaryRows = report ? Math.ceil(o.summaryMetrics.length / 2) : o.summaryMetrics.length;
  let h = PAD * 2 + l.header + (report ? l.postersReport : l.postersCmp) + l.context + summaryRows * l.summaryRow + l.gap + l.footer;
  if (c.dimension && c.rows.length) h += l.gap + l.tableTitle + l.tableHead + c.rows.length * l.tableRow;
  if (o.chart && c.trend && c.trend.points.length > 1) h += l.gap + l.chart;
  return Math.round(h);
}

export function maxRowsForHeight(c: Comparison, o: XPosterOptions, height: number): number {
  const l = layoutFor(o);
  const base = xPosterHeight({ ...c, rows: [] }, o) + l.gap + l.tableTitle + l.tableHead;
  return Math.max(0, Math.floor((height - base) / l.tableRow));
}

// Fits a fixed canvas (X 4:5): the compact layout; breakdown rows come
// first; the chart is kept only if it still fits after them.
export function fitToHeight(c: Comparison, o: XPosterOptions, height: number): { c: Comparison; o: XPosterOptions } {
  let opts: XPosterOptions = { ...o, layout: 'x45' };
  if (opts.chart && xPosterHeight(c, opts) > height) {
    const withoutChart = { ...opts, chart: false };
    const rowsWithChart = maxRowsForHeight(c, opts, height);
    if (rowsWithChart < Math.min(c.rows.length, 5)) opts = withoutChart;
  }
  const fit = maxRowsForHeight(c, opts, height);
  return { c: c.rows.length > fit ? { ...c, rows: c.rows.slice(0, fit) } : c, o: opts };
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// The bundled poster font (lib/poster/fonts, a small Latin subset) has no
// "×"; label text that uses it is drawn with "/" instead of an empty box.
function posterSafe(text: string): string {
  return text.replace(/\s*×\s*/g, ' / ');
}

function val(m: Metrics | null | undefined, k: MetricKey, currency: Currency = 'INR'): string {
  return formatMetric(k, m ? (m[k] as number | null) : null, currency);
}

function label(k: MetricKey, currency: Currency = 'INR'): string {
  return (currency === 'USD' && k === 'venues' ? 'Theatres' : METRIC_LABELS[k]).toUpperCase();
}

function Header({ logoSrc, report, subtitle, lay }: { logoSrc: string; report: boolean; subtitle?: string; lay: Lay }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: lay.header }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} width={116} height={48} style={{ objectFit: 'contain' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: WHITE, letterSpacing: 8 }}>FYRE</div>
        <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: ACCENT_TEXT, letterSpacing: 4 }}>{subtitle ?? (report ? 'MOVIE REPORT' : 'MOVIE COMPARISON')}</div>
      </div>
    </div>
  );
}

function PosterImage({ src, w, h, color }: { src: string | null; w: number; h: number; color: string }) {
  return (
    <div style={{ display: 'flex', width: w, height: h, borderRadius: 16, overflow: 'hidden', border: `3px solid ${color}`, background: CARD, alignItems: 'center', justifyContent: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} width={w} height={h} style={{ objectFit: 'cover' }} /> : <div style={{ display: 'flex', color: FAINT, fontSize: 16 }}>No poster</div>}
    </div>
  );
}

function Posters({ c, images, lay }: { c: Comparison; images: (string | null)[]; lay: Lay }) {
  if (c.movies.length === 1) {
    const m = c.movies[0];
    return (
      <div style={{ display: 'flex', alignItems: 'center', height: lay.postersReport, gap: 36 }}>
        <PosterImage src={images[0]} w={lay.repPosterW} h={lay.repPosterH} color={COLORS[0]} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 50, fontWeight: 700, color: WHITE, lineHeight: 1.1 }}>{clip(m.title, 40)}</div>
          <div style={{ display: 'flex', fontSize: 20, color: DIM, marginTop: 14 }}>{c.selectionLabel}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', height: lay.postersCmp, position: 'relative', paddingTop: 12 }}>
      {c.movies.slice(0, 2).map((m, i) => (
        <div key={m.slug} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 380 }}>
          <PosterImage src={images[i]} w={lay.cmpPosterW} h={lay.cmpPosterH} color={COLORS[i]} />
          <div style={{ display: 'flex', fontSize: m.title.length > 22 ? 26 : 30, fontWeight: 700, color: WHITE, marginTop: 16, textAlign: 'center', justifyContent: 'center', width: 380, lineHeight: 1.2 }}>{clip(m.title, 48)}</div>
        </div>
      ))}
      <div style={{ display: 'flex', position: 'absolute', left: (X_WIDTH - PAD * 2) / 2 - 44, top: lay.vsTop, width: 88, height: 88, borderRadius: 44, background: NAVY, border: `2px solid ${BORDER}`, alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, color: WHITE }}>
        VS
      </div>
    </div>
  );
}

function Context({ c, lay }: { c: Comparison; lay: Lay }) {
  return (
    <div style={{ display: 'flex', height: lay.context, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', padding: '12px 26px', borderRadius: 999, background: ACCENT_TINT, color: ACCENT_TEXT, fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>{c.context}</div>
    </div>
  );
}

function Summary({ c, o }: { c: Comparison; o: XPosterOptions }) {
  const lay = layoutFor(o);
  if (c.movies.length === 1) {
    const m = c.movies[0];
    const pairs: MetricKey[][] = [];
    for (let i = 0; i < o.summaryMetrics.length; i += 2) pairs.push(o.summaryMetrics.slice(i, i + 2));
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {pairs.map((p) => (
          <div key={p.join()} style={{ display: 'flex', height: lay.summaryRow, gap: 16 }}>
            {p.map((k) => (
              <div key={k} style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BORDER}`, padding: '0 8px' }}>
                <div style={{ display: 'flex', fontSize: 18, color: DIM, letterSpacing: 2 }}>{label(k, c.currency)}</div>
                <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: k === 'gross' ? ACCENT_TEXT : WHITE }}>{m.available ? val(m.summary, k, c.currency) : '—'}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  const [a, b] = c.movies;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {o.summaryMetrics.map((k) => {
        const va = a.summary ? (a.summary[k] as number | null) : null;
        const vb = b.summary ? (b.summary[k] as number | null) : null;
        const lead = va != null && vb != null && va !== vb ? (va > vb ? 0 : 1) : -1;
        return (
          <div key={k} style={{ display: 'flex', height: lay.summaryRow, alignItems: 'center', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', flex: 1, fontSize: 38, fontWeight: 700, color: lead === 0 ? COLORS[0] : WHITE }}>{a.available ? val(a.summary, k, c.currency) : '—'}</div>
            <div style={{ display: 'flex', width: 260, justifyContent: 'center', fontSize: 18, color: DIM, letterSpacing: 3 }}>{label(k, c.currency)}</div>
            <div style={{ display: 'flex', flex: 1, justifyContent: 'flex-end', fontSize: 38, fontWeight: 700, color: lead === 1 ? COLORS[1] : WHITE }}>{b.available ? val(b.summary, k, c.currency) : '—'}</div>
          </div>
        );
      })}
    </div>
  );
}

function Breakdown({ c, o }: { c: Comparison; o: XPosterOptions }) {
  if (!c.dimension || !c.rows.length) return null;
  const lay = layoutFor(o);
  const report = c.movies.length === 1;
  const cols: { title: string; get: (r: Comparison['rows'][number]) => string; color: string }[] = report
    ? (['gross', 'tickets', 'occupancy'] as MetricKey[]).map((k) => ({ title: label(k, c.currency), get: (r) => val(r.values[0], k, c.currency), color: k === 'gross' ? ACCENT_TEXT : WHITE }))
    : c.movies.slice(0, 2).map((m, i) => ({ title: clip(m.title, 16).toUpperCase(), get: (r) => (c.breakdownAvailable[i] ? val(r.values[i], o.metric, c.currency) : 'n/a'), color: COLORS[i] }));
  const nameW = report ? 420 : 460;
  const colW = Math.floor((X_WIDTH - PAD * 2 - 40 - nameW) / cols.length);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', height: lay.tableTitle, alignItems: 'center', fontSize: 20, fontWeight: 700, color: WHITE, letterSpacing: 2 }}>
        {`${posterSafe(c.dimensionLabel ?? '').toUpperCase()}${report ? '' : ` · ${label(o.metric, c.currency)}`}`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${BORDER}`, borderRadius: 16, background: CARD, padding: '0 20px' }}>
        <div style={{ display: 'flex', height: lay.tableHead, alignItems: 'center', borderBottom: `2px solid ${ACCENT}` }}>
          <div style={{ display: 'flex', width: nameW, fontSize: 15, color: FAINT, letterSpacing: 2 }}>{posterSafe(c.dimensionLabel ?? '').toUpperCase()}</div>
          {cols.map((col) => (
            <div key={col.title} style={{ display: 'flex', width: colW, justifyContent: 'flex-end', fontSize: 15, fontWeight: 700, color: col.color, letterSpacing: 1 }}>
              {col.title}
            </div>
          ))}
        </div>
        {c.rows.map((r, i) => (
          <div key={r.key} style={{ display: 'flex', height: lay.tableRow, alignItems: 'center', borderBottom: i === c.rows.length - 1 ? 'none' : `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', width: nameW, fontSize: 22, fontWeight: 700, color: WHITE }}>{clip(r.sub && (c.dimension === 'language_state' || c.dimension === 'format_language') ? `${r.name} · ${r.sub}` : r.name, 34)}</div>
            {cols.map((col) => (
              <div key={col.title} style={{ display: 'flex', width: colW, justifyContent: 'flex-end', fontSize: 22, fontWeight: 700, color: WHITE }}>
                {col.get(r)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Chart({ c, lay }: { c: Comparison; lay: Lay }) {
  const t = c.trend;
  if (!t || t.points.length < 2) return null;
  const W = X_WIDTH - PAD * 2;
  const H = lay.chart - 70;
  const vals = t.points.flatMap((p) => p.values).filter((v): v is number => v != null);
  const max = Math.max(...vals, 1);
  const n = t.points.length;
  const x = (i: number) => 12 + (i / (n - 1)) * (W - 24);
  const y = (v: number) => 10 + (1 - v / max) * (H - 20);
  const lines = c.movies.slice(0, 2).map((_, mi) =>
    t.points
      .map((p, i) => (p.values[mi] == null ? null : `${x(i).toFixed(1)},${y(p.values[mi] as number).toFixed(1)}`))
      .filter(Boolean)
      .join(' ')
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: lay.chart }}>
      <div style={{ display: 'flex', height: 36, alignItems: 'center', fontSize: 20, fontWeight: 700, color: WHITE, letterSpacing: 2 }}>
        {`${METRIC_LABELS[t.metric].toUpperCase()} · DAY 1 – DAY ${t.points[n - 1].day}${t.cumulative ? ' (RUNNING TOTAL)' : ''}`}
      </div>
      <div style={{ display: 'flex', border: `1px solid ${BORDER}`, borderRadius: 16, background: CARD }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={10 + f * (H - 20)} y2={10 + f * (H - 20)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          ))}
          {lines.map((pts, i) => (pts ? <polyline key={i} points={pts} fill="none" stroke={COLORS[i]} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" /> : null))}
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: FAINT, marginTop: 6 }}>
        <div style={{ display: 'flex' }}>Day 1</div>
        <div style={{ display: 'flex' }}>{`Peak ${formatMetric(t.metric, max, c.currency)}`}</div>
        <div style={{ display: 'flex' }}>{`Day ${t.points[n - 1].day}`}</div>
      </div>
    </div>
  );
}

// No data-source credit (Fyre licenses the data); the left side says what
// the numbers cover instead.
function Footer({ note, lastUpdated, lay }: { note: string; lastUpdated: string | null; lay: Lay }) {
  return (
    <div style={{ display: 'flex', height: lay.footer, alignItems: 'flex-end', justifyContent: 'space-between', borderTop: `1px solid ${BORDER}`, paddingBottom: 4 }}>
      <div style={{ display: 'flex', fontSize: 16, color: DIM }}>{note}</div>
      <div style={{ display: 'flex', fontSize: lastUpdated && lastUpdated.length > 32 ? 13 : 16, color: FAINT }}>{lastUpdated ? `Last updated: ${lastUpdated}` : ''}</div>
      <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: WHITE }}>fyre.co.in</div>
    </div>
  );
}

export function XPoster({ c, o, images, logoSrc, watermark, height }: { c: Comparison; o: XPosterOptions; images: (string | null)[]; logoSrc: string; watermark: boolean; height: number }) {
  const report = c.movies.length === 1;
  const lay = layoutFor(o);
  return (
    <div style={{ width: X_WIDTH, height, display: 'flex', flexDirection: 'column', background: NAVY, fontFamily: 'Noto Sans', position: 'relative', padding: PAD }}>
      {watermark && <PosterWatermark logoSrc={logoSrc} width={X_WIDTH} height={height} opacity={0.04} />}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', flex: 1 }}>
        <Header logoSrc={logoSrc} report={report} lay={lay} />
        <Posters c={c} images={images} lay={lay} />
        <Context c={c} lay={lay} />
        <Summary c={c} o={o} />
        {c.dimension && c.rows.length > 0 && <div style={{ display: 'flex', height: lay.gap }} />}
        <Breakdown c={c} o={o} />
        {o.chart && c.trend && c.trend.points.length > 1 && <div style={{ display: 'flex', height: lay.gap }} />}
        {o.chart && <Chart c={c} lay={lay} />}
        <div style={{ display: 'flex', flex: 1, minHeight: lay.gap }} />
        <Footer note={c.currency === 'USD' ? 'USA · Indian-language screenings · USD' : 'India · INR'} lastUpdated={c.lastUpdated} lay={lay} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// India + USA for one movie, side by side. Two getComparison() view models
// (India and USA, same movie and selection); nothing is added across them.
// ---------------------------------------------------------------------------
const T_COLORS = ['#F5A524', '#2F6FED'];

export function territoryPosterHeight(india: Comparison, usa: Comparison, o: XPosterOptions): number {
  const l = layoutFor(o);
  const rows = Math.max(india.rows.length, usa.rows.length);
  let h = PAD * 2 + l.header + l.postersReport + l.context + l.colHead + o.summaryMetrics.length * l.summaryRow + l.gap + l.footer;
  if ((india.dimension || usa.dimension) && rows) h += l.gap + l.tableTitle + l.tableHead + rows * l.tableRow;
  return Math.round(h);
}

// India + USA on the fixed X 4:5 canvas: compact layout, breakdown rows
// capped to what fits (both sides get the same number of rows).
export function fitTerritoryToHeight(india: Comparison, usa: Comparison, o: XPosterOptions, height: number): { india: Comparison; usa: Comparison; o: XPosterOptions } {
  const opts: XPosterOptions = { ...o, layout: 'x45' };
  const l = layoutFor(opts);
  const base = territoryPosterHeight({ ...india, rows: [] }, { ...usa, rows: [] }, opts) + l.gap + l.tableTitle + l.tableHead;
  const fit = Math.max(0, Math.floor((height - base) / l.tableRow));
  return { india: { ...india, rows: india.rows.slice(0, fit) }, usa: { ...usa, rows: usa.rows.slice(0, fit) }, o: opts };
}

export function TerritoryPoster({
  india,
  usa,
  o,
  image,
  logoSrc,
  watermark,
  height,
  context
}: {
  india: Comparison;
  usa: Comparison;
  o: XPosterOptions;
  image: string | null;
  logoSrc: string;
  watermark: boolean;
  height: number;
  context: string;
}) {
  const a = india.movies[0];
  const b = usa.movies[0];
  const title = a?.title ?? b?.title ?? '';
  const sides = [
    { c: india, m: a, head: 'INDIA', sub: 'ALL LANGUAGES · INR' },
    { c: usa, m: b, head: 'USA', sub: 'INDIAN-LANGUAGE SCREENINGS · USD' }
  ];
  const rows = Math.max(india.rows.length, usa.rows.length);
  const dimLabel = posterSafe((india.dimensionLabel ?? usa.dimensionLabel ?? '').toUpperCase());
  const half = (X_WIDTH - PAD * 2 - 40) / 2;
  const lay = layoutFor(o);
  const updated = [india.lastUpdated ? `India ${india.lastUpdated}` : null, usa.lastUpdated ? `USA ${usa.lastUpdated}` : null].filter(Boolean).join(' · ') || null;
  return (
    <div style={{ width: X_WIDTH, height, display: 'flex', flexDirection: 'column', background: NAVY, fontFamily: 'Noto Sans', position: 'relative', padding: PAD }}>
      {watermark && <PosterWatermark logoSrc={logoSrc} width={X_WIDTH} height={height} opacity={0.04} />}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', flex: 1 }}>
        <Header logoSrc={logoSrc} report subtitle="INDIA + USA" lay={lay} />
        <div style={{ display: 'flex', alignItems: 'center', height: lay.postersReport, gap: 36 }}>
          <PosterImage src={image} w={lay.repPosterW} h={lay.repPosterH} color={T_COLORS[0]} />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', fontSize: 50, fontWeight: 700, color: WHITE, lineHeight: 1.1 }}>{clip(title, 40)}</div>
            <div style={{ display: 'flex', fontSize: 20, color: DIM, marginTop: 14 }}>{india.selectionLabel}</div>
          </div>
        </div>
        <div style={{ display: 'flex', height: lay.context, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', padding: '12px 26px', borderRadius: 999, background: ACCENT_TINT, color: ACCENT_TEXT, fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>{context}</div>
        </div>
        <div style={{ display: 'flex', height: lay.colHead, alignItems: 'flex-end', borderBottom: `2px solid ${ACCENT}`, paddingBottom: 10 }}>
          {sides.map((sd, i) => (
            <div key={sd.head} style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: i === 0 ? 'flex-start' : 'flex-end' }}>
              <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: T_COLORS[i], letterSpacing: 4 }}>{sd.head}</div>
              <div style={{ display: 'flex', fontSize: 14, color: FAINT, letterSpacing: 2 }}>{sd.sub}</div>
            </div>
          ))}
        </div>
        {o.summaryMetrics.map((k) => (
          <div key={k} style={{ display: 'flex', height: lay.summaryRow, alignItems: 'center', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', flex: 1, fontSize: 38, fontWeight: 700, color: k === 'gross' ? T_COLORS[0] : WHITE }}>{a?.available ? val(a.summary, k, 'INR') : 'N/A'}</div>
            <div style={{ display: 'flex', width: 240, justifyContent: 'center', fontSize: 18, color: DIM, letterSpacing: 3 }}>{METRIC_LABELS[k].toUpperCase()}</div>
            <div style={{ display: 'flex', flex: 1, justifyContent: 'flex-end', fontSize: 38, fontWeight: 700, color: k === 'gross' ? ACCENT_TEXT : WHITE }}>{b?.available ? val(b.summary, k, 'USD') : 'N/A'}</div>
          </div>
        ))}
        {dimLabel && rows > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', height: lay.gap }} />
            <div style={{ display: 'flex', height: lay.tableTitle, alignItems: 'center', justifyContent: 'space-between' }}>
              {sides.map((sd, i) => (
                <div key={sd.head} style={{ display: 'flex', width: half, fontSize: 20, fontWeight: 700, color: T_COLORS[i], letterSpacing: 2 }}>{`${sd.head} TOP ${dimLabel} · ${METRIC_LABELS[o.metric].toUpperCase()}`}</div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {sides.map((sd, i) => (
                <div key={sd.head} style={{ display: 'flex', flexDirection: 'column', width: half, border: `1px solid ${BORDER}`, borderRadius: 16, background: CARD, padding: '0 18px' }}>
                  <div style={{ display: 'flex', height: lay.tableHead, alignItems: 'center', borderBottom: `2px solid ${T_COLORS[i]}`, fontSize: 14, color: FAINT, letterSpacing: 2 }}>
                    {sd.c.breakdownAvailable[0] ? dimLabel : 'NOT AVAILABLE FOR THIS SELECTION'}
                  </div>
                  {Array.from({ length: rows }).map((_, ri) => {
                    const r = sd.c.breakdownAvailable[0] ? sd.c.rows[ri] : undefined;
                    return (
                      <div key={ri} style={{ display: 'flex', height: lay.tableRow, alignItems: 'center', justifyContent: 'space-between', borderBottom: ri === rows - 1 ? 'none' : `1px solid ${BORDER}` }}>
                        <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: WHITE }}>{r ? clip(r.name, 18) : ''}</div>
                        <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: WHITE }}>{r ? val(r.values[0], o.metric, i === 0 ? 'INR' : 'USD') : ''}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flex: 1, minHeight: lay.gap }} />
        <Footer note="INR and USD shown separately — never added" lastUpdated={updated} lay={lay} />
      </div>
    </div>
  );
}

// Tiled, faint fyre logo behind the poster content.
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
