// Show-level drilldown for one movie on one date, read ONLY from bf_show
// (stored by the scheduled sync: the last 7 final days, today's live day
// and open advance dates). A visitor never causes a BFILMY request.
// Nothing here feeds any aggregate number.
import { supabase } from '@/lib/supabaseClient';
import { publicTrackedSlugs } from '@/lib/tracking';
import { hourOrder } from '@/lib/bfilmy/detail';
import { cleanSlug, todayIST } from './load';
import { round2 } from './metrics';

export type ShowRow = {
  venue: string;
  city: string;
  state: string;
  chain: string | null;
  time: string;
  hour: number | null;
  format: string;
  language: string;
  audi: string | null;
  seats: number;
  available: number | null;
  sold: number;
  gross: number;
  occupancy: number | null;
  price?: number | null; // USA: source ticket price for the show
  occupancySource?: number | null; // USA: source figure
};

export type ShowList = {
  date: string;
  kind: 'boxoffice' | 'advance';
  source: 'stored' | 'live' | null;
  available: boolean;
  reason: string | null;
  sourceUpdated: string | null;
  rows: ShowRow[];
  currency?: 'INR' | 'USD';
};

const sortShows = (rows: ShowRow[]) =>
  rows.sort((a, b) => b.gross - a.gross || b.sold - a.sold || hourOrder(a.hour ?? 12) - hourOrder(b.hour ?? 12) || a.venue.localeCompare(b.venue));

export async function loadShows(slug: string, date: string, kind: 'boxoffice' | 'advance' = 'boxoffice'): Promise<ShowList> {
  const safe = cleanSlug(slug);
  const base = { date, kind, rows: [] as ShowRow[] };
  if (!(await publicTrackedSlugs()).has(safe)) return { ...base, source: null, available: false, reason: 'Movie not tracked', sourceUpdated: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ...base, source: null, available: false, reason: 'Invalid date', sourceUpdated: null };

  const stored: any[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await supabase
      .from('bf_show')
      .select('format,language,show_time,hour,audi,seats,available,sold,gross,bf_venue(name,city,state,chain)')
      .eq('slug', safe)
      .eq('kind', kind)
      .eq('date', date)
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(`bf_show: ${error.message}`);
    stored.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  if (stored.length > 0) {
    const { data: file } = await supabase.from('bf_detail_file').select('source_updated').eq('kind', kind).eq('date', date).maybeSingle();
    const rows = stored.map((r: any) => ({
      venue: r.bf_venue?.name ?? '',
      city: r.bf_venue?.city ?? '',
      state: r.bf_venue?.state ?? '',
      chain: r.bf_venue?.chain ?? null,
      time: r.show_time,
      hour: r.hour,
      format: r.format,
      language: r.language,
      audi: r.audi,
      seats: Number(r.seats),
      available: r.available == null ? null : Number(r.available),
      sold: Number(r.sold),
      gross: Number(r.gross),
      occupancy: Number(r.seats) > 0 ? round2((Number(r.sold) / Number(r.seats)) * 100) : null
    }));
    return { ...base, source: 'stored', available: true, reason: null, sourceUpdated: file?.source_updated ?? null, rows: sortShows(rows) };
  }

  const today = todayIST();
  const pending = kind === 'boxoffice' ? date === today : date >= today;
  return {
    ...base,
    source: null,
    available: false,
    reason: pending
      ? 'Show-by-show rows for this date appear after the next scheduled sync.'
      : 'Show-by-show rows are kept for the last 7 days only. Day totals stay permanently and breakdowns for 90 days.',
    sourceUpdated: null
  };
}
