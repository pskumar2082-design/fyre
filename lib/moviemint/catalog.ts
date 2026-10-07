// MovieMint's tracked-movie list -- the catalog of WHICH movies Fyre tracks.
//
// moviemintbo.com/tracked is a public page (allowed by its robots.txt) whose
// server response already embeds the full list in the page's own Next.js
// data payload, so one ordinary page request is enough: no rendering, no
// API calls, no challenge handling. If the site ever answers with an
// interactive challenge, the request is abandoned -- never worked around.
//
// Only identity fields are kept. MovieMint's own gross/ticket figures are
// ignored on purpose: Fyre's numbers come from BFILMY.
import axios from 'axios';

export const MOVIEMINT_ORIGIN = 'https://moviemintbo.com';
export const TRACKED_URL = `${MOVIEMINT_ORIGIN}/tracked`;
const USER_AGENT = 'fyre.co.in catalog sync (+https://fyre.co.in)';

export type MovieMintMovie = {
  id: string; // MovieMint's boxOfficeId, e.g. "the-paradise"
  title: string;
  language: string | null; // null when MovieMint says "Unknown"
  releaseDate: string | null; // YYYY-MM-DD
  poster: string | null;
  badge: string | null; // e.g. "Re-Release"
  sourceUrl: string; // https://moviemintbo.com/movie/<id>
  lastTrackedDate: string | null; // MovieMint's latest tracked date (YYYY-MM-DD)
};

// Concatenates the page's self.__next_f.push([n, "..."]) chunks back into
// the Flight text they encode.
export function flightText(html: string): string {
  let out = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[\d+,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try {
      out += JSON.parse(`"${m[1]}"`);
    } catch {
      // skip a malformed chunk rather than failing the whole list
    }
  }
  return out;
}

const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s && s !== '$undefined' && s.toLowerCase() !== 'unknown' ? s : null;
};

export function parseTrackedPage(html: string): MovieMintMovie[] {
  const text = flightText(html);
  const seen = new Map<string, MovieMintMovie>();
  for (const m of text.matchAll(/\{"boxOfficeId":"[^{}]*?\}/g)) {
    let o: any;
    try {
      o = JSON.parse(m[0]);
    } catch {
      continue;
    }
    const id = clean(o.boxOfficeId);
    const title = clean(o.title);
    if (!id || !title || seen.has(id)) continue;
    const rel = clean(o.releaseDate);
    const src = clean(o.sourceDate);
    seen.set(id, {
      id,
      title,
      language: clean(o.language),
      releaseDate: rel && /^\d{4}-\d{2}-\d{2}$/.test(rel) ? rel : null,
      poster: clean(o.poster),
      badge: clean(o.badge),
      sourceUrl: `${MOVIEMINT_ORIGIN}/movie/${id}`,
      lastTrackedDate: src && /^\d{8}$/.test(src) ? `${src.slice(0, 4)}-${src.slice(4, 6)}-${src.slice(6, 8)}` : null
    });
  }
  return [...seen.values()];
}

const INTERACTIVE_CHALLENGE = /attention required|cf-chl-widget|g-recaptcha|h-captcha|verify you are human/i;

export async function fetchTrackedList(timeoutMs = 30000): Promise<{ movies: MovieMintMovie[]; fetchedAt: string }> {
  const res = await axios.get<string>(TRACKED_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    timeout: timeoutMs,
    responseType: 'text',
    validateStatus: () => true
  });
  if (res.status !== 200) throw new Error(`MovieMint /tracked answered HTTP ${res.status}`);
  const html = String(res.data ?? '');
  if (INTERACTIVE_CHALLENGE.test(html)) throw new Error('MovieMint answered with an interactive challenge; not retrying');
  const movies = parseTrackedPage(html);
  // A page-structure change must never be mistaken for "every movie left
  // MovieMint's list".
  if (movies.length < 10) throw new Error(`MovieMint /tracked parsed only ${movies.length} movies; page format may have changed`);
  return { movies, fetchedAt: new Date().toISOString() };
}
