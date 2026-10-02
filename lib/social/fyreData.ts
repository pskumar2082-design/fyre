// Fyre's own tracked box office for a movie, for a box-office card
// ("Use Fyre data"). Supabase only -- the same analytics the movie page,
// comparison and box-office posters use.
import { firstNDays, loadMovieAnalytics } from '@/lib/analytics/load';
import { loadUsaAnalytics } from '@/lib/analytics/usa';
import { sumMetrics } from '@/lib/analytics/metrics';
import { formatMoney, formatOccupancy } from '@/lib/analytics/format';
import { formatDate } from '@/lib/bfilmy/adapter';
import type { Metrics } from '@/lib/analytics/types';

export type FyreSelection = { kind: 'day'; day: number } | { kind: 'date'; date: string } | { kind: 'first'; days: number } | { kind: 'lifetime' };

export type FyreFigures = {
  slug: string;
  title: string;
  poster: string | null;
  territory: 'IN' | 'US';
  currency: 'INR' | 'USD';
  label: string; // "DAY 8 BOX OFFICE"
  gross: number;
  grossText: string;
  metrics: { label: string; value: string }[];
  final: boolean;
  lastUpdated: string | null;
  note: string;
  days: { day: number | null; date: string; label: string }[]; // what can be picked
};

export async function fyreFigures(slug: string, territory: 'IN' | 'US', sel: FyreSelection): Promise<FyreFigures | { error: string }> {
  const m = territory === 'US' ? await loadUsaAnalytics(slug) : await loadMovieAnalytics(slug);
  if (!m) return { error: `No ${territory === 'US' ? 'USA' : 'India'} data for this movie on Fyre` };
  const cur = territory === 'US' ? 'USD' : 'INR';
  let metrics: Metrics | null = null;
  let label = '';
  let final = true;
  if (sel.kind === 'day' || sel.kind === 'date') {
    const p = sel.kind === 'day' ? m.days.find((d) => d.day === sel.day) : m.days.find((d) => d.date === sel.date);
    if (!p) return { error: sel.kind === 'day' ? `Fyre has no Day ${sel.day} for ${m.title}` : `Fyre has no box office on ${sel.date} for ${m.title}` };
    metrics = p.metrics;
    final = p.final;
    label = p.day != null ? (p.day === 0 ? 'DAY 0 (PREMIERES) BOX OFFICE' : `DAY ${p.day} BOX OFFICE`) : `BOX OFFICE · ${formatDate(p.date).toUpperCase()}`;
  } else if (sel.kind === 'first') {
    const pts = firstNDays(m, sel.days);
    if (!pts?.length) return { error: `Fyre has no first ${sel.days} days for ${m.title}` };
    metrics = sumMetrics(pts.map((p) => p.metrics));
    final = pts.every((p) => p.final);
    label = sel.days === 1 ? 'DAY 1 BOX OFFICE' : `FIRST ${sel.days} DAYS`;
  } else {
    if (!m.days.length) return { error: `No box office tracked yet for ${m.title}` };
    metrics = m.lifetime;
    final = m.state !== 'live';
    label = `TOTAL · ${m.days.length} DAYS`;
  }
  const count = (v: number | null | undefined) => (v == null ? 'N/A' : Math.round(v).toLocaleString(cur === 'USD' ? 'en-US' : 'en-IN'));
  const where = territory === 'US' ? 'USA · Indian-language screenings · USD' : 'India · INR';
  return {
    slug: m.slug,
    title: m.title,
    poster: m.poster,
    territory,
    currency: cur,
    label,
    gross: metrics.gross,
    grossText: formatMoney(metrics.gross, cur),
    metrics: [
      { label: 'Tickets', value: count(metrics.tickets) },
      { label: 'Shows', value: count(metrics.shows) },
      { label: 'Occupancy', value: formatOccupancy(metrics.occupancy) }
    ],
    final,
    lastUpdated: m.lastUpdated,
    note: `Fyre tracked data · ${where}${final ? '' : ' · live, still updating'}${m.lastUpdated ? ` · updated ${m.lastUpdated}` : ''}`,
    days: m.days.map((d) => ({ day: d.day, date: d.date, label: d.label }))
  };
}
