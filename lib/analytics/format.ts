// Display formatting for Fyre Analytics numbers. Formatting only -- every
// number is computed in ./metrics.ts and the loaders.
import type { Currency, MetricKey } from './types';

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

// USD (USA · Indian-language screenings): $1.32M, $123,456, ATP $22.63.
export function formatUsd(dollars: number | null): string {
  if (dollars == null) return '—';
  if (Math.abs(dollars) >= 1e6) return `$${(dollars / 1e6).toFixed(2)}M`;
  return `$${Math.round(dollars).toLocaleString('en-US')}`;
}

export function formatUsdAtp(v: number | null): string {
  return v == null ? '—' : `$${v.toFixed(2)}`;
}

export function formatMoney(v: number | null, currency: Currency = 'INR'): string {
  return currency === 'USD' ? formatUsd(v) : formatGross(v);
}

export function formatMetric(key: MetricKey, v: number | null, currency: Currency = 'INR'): string {
  const usd = currency === 'USD';
  switch (key) {
    case 'gross':
    case 'picGross':
      return usd ? formatUsd(v) : formatGross(v);
    case 'tickets':
    case 'picTickets':
      return usd ? (v == null ? '—' : Math.round(v).toLocaleString('en-US')) : formatTickets(v);
    case 'occupancy':
      return formatOccupancy(v);
    case 'atp':
      return usd ? formatUsdAtp(v) : formatAtp(v);
    default:
      return usd ? (v == null ? '—' : Math.round(v).toLocaleString('en-US')) : formatInt(v);
  }
}

// Labels that differ by territory (USA "Theatres" = distinct theater
// name + city + state; India "Venues" = BFILMY venue ids).
export function metricLabel(key: MetricKey, currency: Currency = 'INR', fallback: string): string {
  if (currency === 'USD' && key === 'venues') return 'Theatres';
  return fallback;
}

export const USA_LABEL = 'USA · Indian-language screenings';
