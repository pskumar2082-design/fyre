// X-ready poster for Fyre Analytics: "Movie Report" (one movie) and
// "Movie Comparison" (Movie A vs Movie B). It renders a Comparison view
// model from lib/analytics/compare.ts exactly as returned -- the same
// numbers the Movie Comparison page shows. No calculation happens here;
// only formatting and layout.
import { formatMetric } from '../analytics/format';
import { METRIC_LABELS } from '../analytics/metrics';
import type { Comparison, MetricKey, Metrics } from '../analytics/types';

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
};

// Layout heights (px) -- the route computes the canvas height from these.
const PAD = 56;
const HEADER = 84;
const POSTERS_CMP = 440;
const POSTERS_REPORT = 330;
const CONTEXT = 76;
const SUMMARY_ROW = 70;
const SECTION_GAP = 26;
const TABLE_TITLE = 44;
const TABLE_HEAD = 50;
const TABLE_ROW = 54;
const CHART = 300;
const FOOTER = 70;

export function xPosterHeight(c: Comparison, o: XPosterOptions): number {
  const report = c.movies.length === 1;
  const summaryRows = report ? Math.ceil(o.summaryMetrics.length / 2) : o.summaryMetrics.length;
  let h = PAD * 2 + HEADER + (report ? POSTERS_REPORT : POSTERS_CMP) + CONTEXT + summaryRows * SUMMARY_ROW + SECTION_GAP + FOOTER;
  if (c.dimension && c.rows.length) h += SECTION_GAP + TABLE_TITLE + TABLE_HEAD + c.rows.length * TABLE_ROW;
  if (o.chart && c.trend && c.trend.points.length > 1) h += SECTION_GAP + CHART;
  return Math.round(h);
}

export function maxRowsForHeight(c: Comparison, o: XPosterOptions, height: number): number {
  const base = xPosterHeight({ ...c, rows: [] }, o) + SECTION_GAP + TABLE_TITLE + TABLE_HEAD;
  return Math.max(0, Math.floor((height - base) / TABLE_ROW));
}

// Fits a fixed canvas: the breakdown rows come first; the chart is kept
// only if it still fits after them.
export function fitToHeight(c: Comparison, o: XPosterOptions, height: number): { c: Comparison; o: XPosterOptions } {
  let opts = o;
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

function val(m: Metrics | null | undefined, k: MetricKey): string {
  return formatMetric(k, m ? (m[k] as number | null) : null);
}

function Header({ logoSrc, report }: { logoSrc: string; report: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: HEADER }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} width={116} height={48} style={{ objectFit: 'contain' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: WHITE, letterSpacing: 8 }}>FYRE</div>
        <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: ACCENT_TEXT, letterSpacing: 4 }}>{report ? 'MOVIE REPORT' : 'MOVIE COMPARISON'}</div>
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

function Posters({ c, images }: { c: Comparison; images: (string | null)[] }) {
  if (c.movies.length === 1) {
    const m = c.movies[0];
    return (
      <div style={{ display: 'flex', alignItems: 'center', height: POSTERS_REPORT, gap: 36 }}>
        <PosterImage src={images[0]} w={200} h={300} color={COLORS[0]} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 50, fontWeight: 700, color: WHITE, lineHeight: 1.1 }}>{clip(m.title, 40)}</div>
          <div style={{ display: 'flex', fontSize: 20, color: DIM, marginTop: 14 }}>{c.selectionLabel}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', height: POSTERS_CMP, position: 'relative', paddingTop: 12 }}>
      {c.movies.slice(0, 2).map((m, i) => (
        <div key={m.slug} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 380 }}>
          <PosterImage src={images[i]} w={220} h={300} color={COLORS[i]} />
          <div style={{ display: 'flex', fontSize: m.title.length > 22 ? 26 : 30, fontWeight: 700, color: WHITE, marginTop: 16, textAlign: 'center', justifyContent: 'center', width: 380, lineHeight: 1.2 }}>{clip(m.title, 48)}</div>
        </div>
      ))}
      <div style={{ display: 'flex', position: 'absolute', left: (X_WIDTH - PAD * 2) / 2 - 44, top: 118, width: 88, height: 88, borderRadius: 44, background: NAVY, border: `2px solid ${BORDER}`, alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, color: WHITE }}>
        VS
      </div>
    </div>
  );
}

function Context({ c }: { c: Comparison }) {
  return (
    <div style={{ display: 'flex', height: CONTEXT, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', padding: '12px 26px', borderRadius: 999, background: ACCENT_TINT, color: ACCENT_TEXT, fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>{c.context}</div>
    </div>
  );
}

function Summary({ c, o }: { c: Comparison; o: XPosterOptions }) {
  if (c.movies.length === 1) {
    const m = c.movies[0];
    const pairs: MetricKey[][] = [];
    for (let i = 0; i < o.summaryMetrics.length; i += 2) pairs.push(o.summaryMetrics.slice(i, i + 2));
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {pairs.map((p) => (
          <div key={p.join()} style={{ display: 'flex', height: SUMMARY_ROW, gap: 16 }}>
            {p.map((k) => (
              <div key={k} style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BORDER}`, padding: '0 8px' }}>
                <div style={{ display: 'flex', fontSize: 18, color: DIM, letterSpacing: 2 }}>{METRIC_LABELS[k].toUpperCase()}</div>
                <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: k === 'gross' ? ACCENT_TEXT : WHITE }}>{m.available ? val(m.summary, k) : '—'}</div>
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
          <div key={k} style={{ display: 'flex', height: SUMMARY_ROW, alignItems: 'center', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', flex: 1, fontSize: 38, fontWeight: 700, color: lead === 0 ? COLORS[0] : WHITE }}>{a.available ? val(a.summary, k) : '—'}</div>
            <div style={{ display: 'flex', width: 260, justifyContent: 'center', fontSize: 18, color: DIM, letterSpacing: 3 }}>{METRIC_LABELS[k].toUpperCase()}</div>
            <div style={{ display: 'flex', flex: 1, justifyContent: 'flex-end', fontSize: 38, fontWeight: 700, color: lead === 1 ? COLORS[1] : WHITE }}>{b.available ? val(b.summary, k) : '—'}</div>
          </div>
        );
      })}
    </div>
  );
}

function Breakdown({ c, o }: { c: Comparison; o: XPosterOptions }) {
  if (!c.dimension || !c.rows.length) return null;
  const report = c.movies.length === 1;
  const cols: { title: string; get: (r: Comparison['rows'][number]) => string; color: string }[] = report
    ? (['gross', 'tickets', 'occupancy'] as MetricKey[]).map((k) => ({ title: METRIC_LABELS[k].toUpperCase(), get: (r) => val(r.values[0], k), color: k === 'gross' ? ACCENT_TEXT : WHITE }))
    : c.movies.slice(0, 2).map((m, i) => ({ title: clip(m.title, 16).toUpperCase(), get: (r) => (c.breakdownAvailable[i] ? val(r.values[i], o.metric) : 'n/a'), color: COLORS[i] }));
  const nameW = report ? 420 : 460;
  const colW = Math.floor((X_WIDTH - PAD * 2 - 40 - nameW) / cols.length);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', height: TABLE_TITLE, alignItems: 'center', fontSize: 20, fontWeight: 700, color: WHITE, letterSpacing: 2 }}>
        {`${(c.dimensionLabel ?? '').toUpperCase()}${report ? '' : ` · ${METRIC_LABELS[o.metric].toUpperCase()}`}`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${BORDER}`, borderRadius: 16, background: CARD, padding: '0 20px' }}>
        <div style={{ display: 'flex', height: TABLE_HEAD, alignItems: 'center', borderBottom: `2px solid ${ACCENT}` }}>
          <div style={{ display: 'flex', width: nameW, fontSize: 15, color: FAINT, letterSpacing: 2 }}>{(c.dimensionLabel ?? '').toUpperCase()}</div>
          {cols.map((col) => (
            <div key={col.title} style={{ display: 'flex', width: colW, justifyContent: 'flex-end', fontSize: 15, fontWeight: 700, color: col.color, letterSpacing: 1 }}>
              {col.title}
            </div>
          ))}
        </div>
        {c.rows.map((r, i) => (
          <div key={r.key} style={{ display: 'flex', height: TABLE_ROW, alignItems: 'center', borderBottom: i === c.rows.length - 1 ? 'none' : `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', width: nameW, fontSize: 22, fontWeight: 700, color: WHITE }}>{clip(r.sub && c.dimension === 'language_state' ? `${r.name} · ${r.sub}` : r.name, 34)}</div>
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

function Chart({ c }: { c: Comparison }) {
  const t = c.trend;
  if (!t || t.points.length < 2) return null;
  const W = X_WIDTH - PAD * 2;
  const H = CHART - 70;
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
    <div style={{ display: 'flex', flexDirection: 'column', height: CHART }}>
      <div style={{ display: 'flex', height: 36, alignItems: 'center', fontSize: 20, fontWeight: 700, color: WHITE, letterSpacing: 2 }}>
        {`${METRIC_LABELS[t.metric].toUpperCase()} · DAY 1 → DAY ${t.points[n - 1].day}${t.cumulative ? ' (RUNNING TOTAL)' : ''}`}
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
        <div style={{ display: 'flex' }}>{`Peak ${formatMetric(t.metric, max)}`}</div>
        <div style={{ display: 'flex' }}>{`Day ${t.points[n - 1].day}`}</div>
      </div>
    </div>
  );
}

function Footer({ c }: { c: Comparison }) {
  return (
    <div style={{ display: 'flex', height: FOOTER, alignItems: 'flex-end', justifyContent: 'space-between', borderTop: `1px solid ${BORDER}`, paddingBottom: 4 }}>
      <div style={{ display: 'flex', fontSize: 16, color: DIM }}>Data: BFILMY</div>
      <div style={{ display: 'flex', fontSize: 16, color: FAINT }}>{c.lastUpdated ? `Last updated: ${c.lastUpdated}` : ''}</div>
      <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: WHITE }}>fyre.co.in</div>
    </div>
  );
}

export function XPoster({ c, o, images, logoSrc, watermark, height }: { c: Comparison; o: XPosterOptions; images: (string | null)[]; logoSrc: string; watermark: boolean; height: number }) {
  const report = c.movies.length === 1;
  return (
    <div style={{ width: X_WIDTH, height, display: 'flex', flexDirection: 'column', background: NAVY, fontFamily: 'Noto Sans', position: 'relative', padding: PAD }}>
      {watermark && <PosterWatermark logoSrc={logoSrc} width={X_WIDTH} height={height} opacity={0.04} />}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', flex: 1 }}>
        <Header logoSrc={logoSrc} report={report} />
        <Posters c={c} images={images} />
        <Context c={c} />
        <Summary c={c} o={o} />
        {c.dimension && c.rows.length > 0 && <div style={{ display: 'flex', height: SECTION_GAP }} />}
        <Breakdown c={c} o={o} />
        {o.chart && c.trend && c.trend.points.length > 1 && <div style={{ display: 'flex', height: SECTION_GAP }} />}
        {o.chart && <Chart c={c} />}
        <div style={{ display: 'flex', flex: 1, minHeight: SECTION_GAP }} />
        <Footer c={c} />
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
