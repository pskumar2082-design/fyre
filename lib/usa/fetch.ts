// BFILMY USA files (public static JSON on Cloudflare Pages, no key; the
// same files BFILMY's /usa/ pages load; BFILMY has given Fyre permission
// to use them). One request at a time; ETag lets unchanged files be skipped.
import axios from 'axios';
import type { UsKind } from './normalize';

const USER_AGENT = 'fyre.co.in data sync (+https://fyre.co.in)';

export function usFileUrl(kind: UsKind, date: string): string {
  const [y, m, d] = date.split('-');
  const dir = kind === 'boxoffice' ? 'usa-boxoffice' : 'usa-advance';
  return `https://usadata${y}.pages.dev/${dir}/${y}/${d}-${m}.json`;
}

export type UsFetch =
  | { status: 'ok'; url: string; etag: string | null; json: unknown }
  | { status: 'not_modified'; url: string; etag: string | null }
  | { status: 'missing'; url: string };

export async function fetchUsFile(kind: UsKind, date: string, etag?: string | null): Promise<UsFetch> {
  const url = usFileUrl(kind, date);
  const res = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(etag ? { 'If-None-Match': etag } : {}) },
    timeout: 30000,
    responseType: 'json',
    validateStatus: () => true
  });
  const tag = (res.headers['etag'] as string | undefined) ?? null;
  if (res.status === 304) return { status: 'not_modified', url, etag: tag ?? etag ?? null };
  if (res.status === 404) return { status: 'missing', url };
  if (res.status !== 200) throw new Error(`HTTP ${res.status} for ${url}`);
  return { status: 'ok', url, etag: tag, json: res.data };
}
