// Show-level drilldown for one movie on one date. Read from bf_show while
// the date is inside the raw-detail window; for today's (still changing)
// file, read BFILMY's live show-level file directly (cached briefly).
// Nothing here feeds any aggregate number.
import { supabase } from '@/lib/supabaseClient';
import { publicTrackedSlugs } from '@/lib/tracking';
import { fetchAliases, fetchDetail } from '@/lib/bfilmy/fetch';
import { normalizeDetailFile, hourOrder } from '@/lib/bfilmy/detail';
import { buildAliasMap } from '@/lib/bfilmy/normalize';
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
};

export type ShowList = {
  date: string;
  kind: 'boxoffice' | 'advance';
  source: 'stored' | 'live' | null;
  available: boolean;
  reason: string | null;
  sourceUpdated: string | null;
  rows: ShowRow[];
};

const liveCache = new Map<string, { at: number; value: Promise<{ updated: string | null; byKey: Map<string, ShowRow[]> } | null> }>();

function loadLive(kind: 'boxoffice' | 'advance', date: string) {
  const key = `${kind}:${date}`;
  const hit = liveCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.value;
  const value = (async () => {
    const got = await fetchDetail(kind, date);
    if (!got) return null;
    const aliasMap = buildAliasMap(await fetchAliases());
    const days = normalizeDetailFile(got.file, kind, date, aliasMap);
    const byKey = new Map<string, ShowRow[]>();
    for (const d of days) {
      byKey.set(
        d.key,
        d.shows.map((s) => ({
          venue: s.venueName,
          city: s.city,
          state: s.state,
          chain: s.chain || null,
          time: s.time,
          hour: s.hour,
          format: s.format,
          language: s.language,
          audi: s.audi || null,
          seats: s.seats,
          available: s.available,
          sold: s.sold,
          gross: s.gross,
          occupancy: s.seats > 0 ? round2((s.sold / s.seats) * 100) : null
        }))
      );
    }
    return { updated: got.file.last_updated ?? null, byKey };
  })();
  liveCache.set(key, { at: Date.now(), value });
  value.catch(() => liveCache.delete(key));
  return value;
}

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
  const isLive = kind === 'boxoffice' ? date === today : date > today;
  if (!isLive) {
    return {
      ...base,
      source: null,
      available: false,
      reason: 'Show-by-show rows are kept for the last 7 days only. Day totals stay permanently and breakdowns for 90 days.',
      sourceUpdated: null
    };
  }
  const { data: keys } = await supabase.from('bf_title_key').select('key').eq('slug', safe);
  const live = await loadLive(kind, date);
  if (!live) return { ...base, source: null, available: false, reason: 'No show-level file published for this date yet', sourceUpdated: null };
  const rows = (keys ?? []).flatMap((k: any) => live.byKey.get(k.key) ?? []);
  return { ...base, source: 'live', available: rows.length > 0, reason: rows.length ? null : 'No shows listed for this movie yet', sourceUpdated: live.updated, rows: sortShows(rows) };
}
