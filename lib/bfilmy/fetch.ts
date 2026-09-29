// Network access to BFILMY's public static JSON files. Every URL here is
// one BFILMY's own website loads in a normal browser (captured from their
// /live-boxoffice/ and /advance-bookings/ pages) -- plain Cloudflare
// Pages files, no token or key involved. BFILMY's owners have given fyre
// permission to use this data.
import axios from 'axios';
import type { BfAliasFile, BfKind, BfRawSummaryFile } from './types';

const USER_AGENT = 'fyre.co.in data sync (+https://fyre.co.in)';

// "2026-09-29" -> the three URL spellings BFILMY uses for that date.
function dateParts(date: string) {
  const [y, m, d] = date.split('-');
  return { y, m, d, compact: `${y}${m}${d}` };
}

// Recent days live on bfilmyapi.pages.dev; older days move to a per-year
// archive project (bfilmyapi2026.pages.dev/...). Both are tried. Order
// matters: for an old date the current host can hang until the request
// times out instead of answering 404, so anything older than two weeks
// tries the archive first.
export function summaryUrls(kind: BfKind, date: string, now: Date = new Date()): string[] {
  const { y, m, d, compact } = dateParts(date);
  const dir = kind === 'boxoffice' ? 'daily' : 'advance';
  const current = `https://bfilmyapi.pages.dev/${dir}/data/${compact}/finalsummary.json`;
  const archive = `https://bfilmyapi${y}.pages.dev/${dir}/data/${y}/${m}-${d}_finalsummary.json`;
  const ageDays = (now.getTime() - Date.parse(`${date}T00:00:00Z`)) / 86_400_000;
  return ageDays > 14 ? [archive, current] : [current, archive];
}

export const ALIAS_URL = 'https://bfilmy.pages.dev/mergedmovies.json';
export const POSTER_LIST_URL = 'https://districtapi.pages.dev/districtmovies.json';

export class BfNotFound extends Error {}

// axios rather than global fetch on purpose: these files are served
// gzip/brotli-compressed, and Next's instrumented server-side fetch has
// already been caught failing to decompress a compressed response in this
// codebase (see the long comment in lib/supabaseClient.ts). axios's Node
// adapter decompresses itself -- the same client the TrackTollywood
// scraper has used in production.
async function getJson<T>(url: string, timeoutMs = 20000): Promise<T> {
  const res = await axios.get<T>(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    timeout: timeoutMs,
    responseType: 'json',
    validateStatus: () => true
  });
  if (res.status === 404) throw new BfNotFound(`404 ${url}`);
  if (res.status !== 200) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.data;
}

// Returns null when BFILMY simply hasn't published a file for that date
// (e.g. today's box office before the first show, or an advance date that
// never opened) -- a normal outcome, not an error.
export async function fetchSummary(kind: BfKind, date: string): Promise<{ url: string; file: BfRawSummaryFile } | null> {
  let lastErr: unknown = null;
  for (const url of summaryUrls(kind, date)) {
    try {
      const file = await getJson<BfRawSummaryFile>(url);
      if (file && typeof file === 'object' && file.movies && typeof file.movies === 'object') return { url, file };
    } catch (err) {
      if (err instanceof BfNotFound) continue;
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

export async function fetchAliases(): Promise<BfAliasFile | null> {
  try {
    return await getJson<BfAliasFile>(ALIAS_URL);
  } catch {
    return null; // aliases only improve grouping; never block a sync on them
  }
}

export async function fetchPosterRows(): Promise<unknown[] | null> {
  try {
    return await getJson<unknown[]>(POSTER_LIST_URL, 30000);
  } catch {
    return null;
  }
}
