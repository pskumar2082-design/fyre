// Admin-only network access for the X Post Designer. Fixed hosts only:
// X's embed endpoints for the post itself and X's media CDN for its images.
// There is no way to make this fetch any other URL -- callers pass a post
// id (already validated by parseXPostUrl) or a media URL that must pass
// isAllowedMediaUrl. Never called from a public page.
import { isAllowedMediaUrl, mediaVariant, normalizeSyndication, parseOembed, syndicationToken, type ImportedPost, type XPostRef } from './xPost';

const FETCH_HOSTS = new Set(['cdn.syndication.twimg.com', 'publish.x.com', 'publish.twitter.com', 'pbs.twimg.com']);

export class XFetchError extends Error {}

async function safeFetch(url: string, opts: { accept: string; maxBytes: number; timeoutMs?: number }, hops = 0): Promise<{ status: number; body: Buffer; type: string }> {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !FETCH_HOSTS.has(u.hostname) || u.port || u.username) throw new XFetchError(`Refused to fetch ${u.hostname}`);
  const res = await fetch(u, {
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000),
    // Uncompressed: Next's server fetch has failed to decompress responses
    // before (same reason as lib/supabaseFetch.ts).
    headers: { Accept: opts.accept, 'Accept-Encoding': 'identity', 'User-Agent': 'Mozilla/5.0 (compatible; FyreAdmin/1.0; +https://fyre.co.in)' }
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (!loc || hops >= 2) throw new XFetchError('Too many redirects');
    return safeFetch(new URL(loc, u).toString(), opts, hops + 1); // same host allowlist applies
  }
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > opts.maxBytes) throw new XFetchError('Response too large');
  const chunks: Buffer[] = [];
  let total = 0;
  if (res.body) {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > opts.maxBytes) {
        await reader.cancel();
        throw new XFetchError('Response too large');
      }
      chunks.push(Buffer.from(value));
    }
  }
  return { status: res.status, body: Buffer.concat(chunks), type: res.headers.get('content-type') ?? '' };
}

// Counts outbound requests (tests / diagnostics).
export const xFetchLog: string[] = [];

async function getJson(url: string, why: string[], label: string): Promise<any | null> {
  xFetchLog.push(url);
  try {
    const r = await safeFetch(url, { accept: 'application/json', maxBytes: 2_000_000 });
    if (r.status !== 200) {
      why.push(`${label}: HTTP ${r.status}`);
      return null;
    }
    try {
      return JSON.parse(r.body.toString('utf8'));
    } catch {
      why.push(`${label}: unreadable response (${r.type || 'unknown type'}, ${r.body.length} bytes)`);
      return null;
    }
  } catch (err: any) {
    why.push(`${label}: ${err?.cause?.code ?? err?.name ?? ''} ${err?.message ?? err}`.trim());
    return null;
  }
}

// The post: X's embed data first (text, author, date, hashtags, links,
// media); its oEmbed as a fallback, and for the full text of long posts.
export async function importXPost(ref: XPostRef): Promise<{ post: ImportedPost; warnings: string[] }> {
  const warnings: string[] = [];
  const why: string[] = [];
  const j = await getJson(`https://cdn.syndication.twimg.com/tweet-result?id=${ref.id}&lang=en&token=${syndicationToken(ref.id)}`, why, 'embed data');
  let post: ImportedPost | null = j ? normalizeSyndication(j, ref) : null;
  if (j && !post) why.push(`embed data: no post in the response (${String(j.__typename ?? 'empty')})`);
  if (!post || post.truncated) {
    const o = await getJson(`https://publish.x.com/oembed?url=${encodeURIComponent(`https://twitter.com/i/status/${ref.id}`)}&omit_script=1&dnt=true`, why, 'oEmbed');
    const op = o ? parseOembed(o, ref) : null;
    if (!post) post = op;
    else if (op && op.text.length > post.text.length) {
      post = { ...post, text: op.text, hashtags: [...new Set([...post.hashtags, ...op.hashtags])], truncated: /…\s*$/.test(op.text) };
    }
  }
  if (!post) {
    console.warn(`[x-post] import ${ref.id} failed: ${why.join('; ')}`);
    throw new XFetchError(`Could not read this post (${why.join('; ') || 'no data'}). It may be deleted, private, age-restricted or from a suspended account.`);
  }
  if (post.truncated || /…\s*$/.test(post.text)) {
    post = { ...post, truncated: true };
    warnings.push('This is a long post: X only shares its first part outside the app. Paste the rest into Post text if you need it.');
  }
  if (post.via === 'oembed') warnings.push('Media could not be read for this post (text only).');
  return { post, warnings };
}

// One X image as a data URI for the poster renderer (JPEG/PNG only, ≤ 10 MB).
// Small in-memory cache so live preview re-renders don't refetch.
const cache = new Map<string, string>();
export async function mediaDataUri(url: string, variant: 'small' | 'large' = 'large'): Promise<string> {
  if (!isAllowedMediaUrl(url)) throw new XFetchError('Image is not from X media');
  const src = mediaVariant(url, variant);
  const hit = cache.get(src);
  if (hit) return hit;
  xFetchLog.push(src);
  const r = await safeFetch(src, { accept: 'image/jpeg,image/png', maxBytes: 10_000_000 });
  if (r.status !== 200) throw new XFetchError(`Image HTTP ${r.status}`);
  const b = r.body;
  const isJpg = b[0] === 0xff && b[1] === 0xd8;
  const isPng = b[0] === 0x89 && b[1] === 0x50;
  if (!isJpg && !isPng) throw new XFetchError('Image is not JPEG/PNG');
  const uri = `data:image/${isJpg ? 'jpeg' : 'png'};base64,${b.toString('base64')}`;
  cache.set(src, uri);
  if (cache.size > 24) cache.delete(cache.keys().next().value as string);
  return uri;
}
