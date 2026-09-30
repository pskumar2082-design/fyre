// Display formatting for Fyre Analytics numbers. Formatting only -- every
// number is computed in ./metrics.ts and the loaders.
import type { MetricKey } from './types';

export function formatGross(rupees: number | null): string {
  if (rupees == null) return '—';
  if (rupees >= 1e7) return `₹${(rupees / 1e7).toFixed(2)} Cr`;
  if (rupees >= 1e5) return `₹${(rupees / 1e5).toFixed(2)} L`;
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}

export function formatTickets(v: number | null): string {
  if (v == null) return '—';
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
  return Math.round(v).toLocaleString('en-IN');
}

export function formatInt(v: number | null): string {
  return v == null ? '—' : Math.round(v).toLocaleString('en-IN');
}

export function formatOccupancy(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(1)}%`;
}

export function formatAtp(v: number | null): string {
  return v == null ? '—' : `₹${Math.round(v).toLocaleString('en-IN')}`;
}

export function formatMetric(key: MetricKey, v: number | null): string {
  switch (key) {
    case 'gross':
    case 'picGross':
      return formatGross(v);
    case 'tickets':
    case 'picTickets':
      return formatTickets(v);
    case 'occupancy':
      return formatOccupancy(v);
    case 'atp':
      return formatAtp(v);
    default:
      return formatInt(v);
  }
}
