import { formatDate } from '@/lib/bfilmy/adapter';
import { formatMetric, formatMoney, formatOccupancy } from '@/lib/analytics/format';
import type { Currency } from '@/lib/analytics/types';
import type { StatsColumn, StatsPoint } from '@/lib/analytics/statsModel';

export type ChartMetric = 'gross' | 'tickets' | 'shows' | 'seats';

export const METRIC_NAME: Record<ChartMetric, string> = { gross: 'Gross', tickets: 'Tickets', shows: 'Shows', seats: 'Seats' };

export function fmtMetric(metric: ChartMetric, v: number | null, cur: Currency): string {
  if (v == null) return '—';
  return metric === 'gross' ? formatMoney(v, cur) : formatMetric(metric, v, cur);
}

// Axis labels: short ("₹1.2 Cr", "$1.3M", "2.4L", "12k")
export function axisMoney(v: number, cur: Currency): string {
  if (cur === 'USD') return v >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)} L`;
  if (v >= 1e3) return `₹${Math.round(v / 1e3)}k`;
  return `₹${Math.round(v)}`;
}

export function axisCount(v: number, cur: Currency): string {
  if (cur === 'INR') return v >= 1e7 ? `${(v / 1e7).toFixed(1)} Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(1)} L` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : `${Math.round(v)}`;
  return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : `${Math.round(v)}`;
}

export const axisFor = (metric: ChartMetric, cur: Currency) => (v: number) => (metric === 'gross' ? axisMoney(v, cur) : axisCount(v, cur));

export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1]}`;
}

export function pointAxisLabel(p: Pick<StatsPoint, 'day' | 'date'>): string {
  return p.day != null && p.day >= 0 ? `D${p.day}` : shortDate(p.date);
}

export function pointTooltip(p: Pick<StatsPoint, 'label' | 'date' | 'window' | 'final'>): string {
  const extra = p.window === 'later' ? ' · later day' : '';
  const live = p.final ? '' : ' · live';
  return p.label === formatDate(p.date) ? `${p.label}${extra}${live}` : `${p.label} · ${formatDate(p.date)}${extra}${live}`;
}

export function fmtColumn(col: StatsColumn, v: number | null | undefined, cur: Currency): string {
  if (v == null) return '—';
  switch (col) {
    case 'gross':
      return formatMoney(v, cur);
    case 'share':
      return `${v.toFixed(1)}%`;
    case 'occupancy':
    case 'occupancySource':
      return formatOccupancy(v);
    case 'atp':
      return formatMetric('atp', v, cur);
    default:
      return formatMetric('shows', v, cur);
  }
}

export const COLUMN_LABEL: Record<StatsColumn, string> = {
  gross: 'Gross',
  share: 'Share',
  tickets: 'Tickets',
  shows: 'Shows',
  seats: 'Seats',
  occupancy: 'Occ.',
  occupancySource: 'Occ. (published)',
  atp: 'ATP',
  venues: 'Venues',
  cities: 'Cities',
  ff: 'FF',
  hf: 'HF'
};

export const STATE_TEXT: Record<string, string> = { live: 'Running', advance: 'Advance open', upcoming: 'Upcoming', final: 'Completed', unknown: 'Tracked' };
