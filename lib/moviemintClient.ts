import { DATA_MARKERS, INTERACTIVE_CHALLENGE_MARKERS } from '@/lib/moviemintChallengeMarkers';
import { renderMovieMintPage } from '@/lib/moviemintBrowserRenderer';

// ---------------------------------------------------------------------------
// Retrieval only. No parsing, no DB access here -- see moviemintParser.ts /
// syncMovieMint.ts for those.
//
// MovieMint (https://moviemintbo.com) is a client-rendered Next.js app: the
// server's initial HTML response for every page we checked (/, /advance,
// /movie/<slug>) is an empty shell -- a branded loading screen with no
// movie data anywhere in the markup -- and the real numbers only appear
// after the browser executes the page's own JS. Confirmed by reading the
// raw response body directly, not just the rendered DOM.
//
// The site also runs Cloudflare's automatic bot-management/"challenge
// platform" script on every page load (a background script + a "oneshot"
// verification call, no visible puzzle or checkbox in any normal
// navigation done during this investigation). That's different from an
// interactive CAPTCHA: it's the same non-interactive check any ordinary
// visitor's browser passes automatically just by loading the page and
// running its JS like normal.
//
// Retrieval tiers, tried in order, every call:
//   1. Plain HTTP (least invasive; also future-proof if MovieMint ever
//      starts server-rendering real data on a path we haven't checked).
//   2. Local headless-Chromium render (lib/moviemintBrowserRenderer.ts) --
//      puppeteer-core + @sparticuz/chromium, running INSIDE this same
//      Vercel serverless function. $0: no external service, no API key,
//      just this function's own compute time. This is the PRIMARY path
//      once plain HTTP comes back empty.
//   3. An optional, operator-configured external render endpoint
//      (MOVIEMINT_RENDER_ENDPOINT) -- tried ONLY if tier 2 reports the
//      renderer itself is unavailable in this environment (e.g. the
//      Chromium binary failed to launch), never as a first choice, and
//      never when tier 2 reports the page was blocked -- an external
//      service would hit the exact same wall MovieMint just put up, so
//      trying it there would just be extra unnecessary traffic.
//
// If ANY tier's response shows signs of an interactive challenge (a
// CAPTCHA checkbox, "Attention Required", etc. -- not the passive
// background script above), this stops that request and reports it.
// No token extraction, no challenge-solving, no workaround, anywhere.
//
// Only the paths robots.txt allows are ever requested. /api/ and /admin/
// are hard-blocked in code, not just by convention -- refused before any
// network call or browser navigation is made.
// ---------------------------------------------------------------------------

const ORIGIN = 'https://moviemintbo.com';

const USER_AGENT =
  'FyreBoxOfficeBot/1.0 (+personal project; reads public MovieMint pages only, respects robots.txt, conservative request rate)';

// Only these path shapes are ever fetched. Everything else -- most
// importantly /api/ and /admin/, which robots.txt disallows -- is refused
// before any network call is made.
const ALLOWED_PATH_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/advance\/?$/,
  /^\/tracked\/?$/,
  /^\/movie\/[a-z0-9-]+\/?$/i,
  /^\/multiplex-report\/?$/
];

function isPathAllowed(path: string): boolean {
  if (path.startsWith('/api/') || path.startsWith('/admin/')) return false;
  return ALLOWED_PATH_PATTERNS.some((re) => re.test(path.split('?')[0]));
}

// Signs the page is the empty client-rendered shell, not real content yet.
const LOADING_SHELL_MARKERS = ['CONNECTING TO SERVER', 'FINALIZING DASHBOARD'];

export type MovieMintFetchResult =
  | { status: 'ok'; html: string; via: 'http' | 'local-render' | 'render-endpoint' }
  | { status: 'render_required'; path: string; snippet: string }
  | { status: 'blocked'; path: string; reason: string }
  | { status: 'error'; path: string; message: string };

function containsAny(html: string, needles: string[]): boolean {
  return needles.some((n) => html.includes(n));
}

function looksLikeInteractiveChallenge(html: string): boolean {
  return containsAny(html, INTERACTIVE_CHALLENGE_MARKERS);
}

function looksLikeRealData(html: string): boolean {
  return containsAny(html, DATA_MARKERS);
}

function looksLikeLoadingShell(html: string): boolean {
  return containsAny(html, LOADING_SHELL_MARKERS) && !looksLikeRealData(html);
}

// Conservative, self-enforced pacing -- MovieMint's robots.txt doesn't set
// a Crawl-delay (Sacnilk's does), so this holds itself to one request
// every 2 seconds minimum regardless of how the caller loops, rather than
// assume no limit means no limit. Applies across every tier (plain HTTP,
// local render navigation, and the optional external endpoint), since
// each is still one MovieMint page load either way.
const MIN_REQUEST_INTERVAL_MS = 2000;
let lastRequestAt = 0;

async function politeWait() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

async function fetchPlainHttp(path: string): Promise<{ html: string } | { error: string }> {
  try {
    const res = await fetch(`${ORIGIN}${path}`, {
      headers: { 'User-Agent': USER_AGENT },
      cache: 'no-store'
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const html = await res.text();
    return { html };
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}

// Optional operator-provided rendering service -- fallback only, see
// module doc above for exactly when this is tried. Expected contract:
// POST { url } -> { html }.
async function fetchViaRenderEndpoint(path: string): Promise<{ html: string } | { error: string }> {
  const endpoint = process.env.MOVIEMINT_RENDER_ENDPOINT;
  if (!endpoint) return { error: 'MOVIEMINT_RENDER_ENDPOINT not configured' };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: `${ORIGIN}${path}`, waitForText: 'GROSS' }),
      cache: 'no-store'
    });
    if (!res.ok) return { error: `render endpoint HTTP ${res.status}` };
    const data = await res.json().catch(() => null);
    if (!data?.html || typeof data.html !== 'string') return { error: 'render endpoint returned no html' };
    return { html: data.html };
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}

export async function fetchMovieMintPage(path: string): Promise<MovieMintFetchResult> {
  if (!isPathAllowed(path)) {
    return { status: 'blocked', path, reason: 'path not in the permitted public-page allowlist (or under /api//admin/)' };
  }

  // --- Tier 1: plain HTTP ---------------------------------------------
  await politeWait();
  const plain = await fetchPlainHttp(path);
  if ('html' in plain) {
    if (looksLikeInteractiveChallenge(plain.html)) {
      return { status: 'blocked', path, reason: 'interactive challenge detected on plain HTTP response' };
    }
    if (looksLikeRealData(plain.html)) {
      return { status: 'ok', html: plain.html, via: 'http' };
    }
    if (!looksLikeLoadingShell(plain.html)) {
      // Not the known shell and not recognizably real data either --
      // still worth trying to render rather than guessing further.
    }
  }

  // --- Tier 2: local headless-Chromium render (the $0 primary path) ---
  await politeWait();
  const rendered = await renderMovieMintPage(`${ORIGIN}${path}`);
  if (rendered.status === 'ok') {
    if (looksLikeInteractiveChallenge(rendered.html)) {
      return { status: 'blocked', path, reason: 'interactive challenge detected on locally-rendered page' };
    }
    return { status: 'ok', html: rendered.html, via: 'local-render' };
  }
  if (rendered.status === 'blocked') {
    return { status: 'blocked', path, reason: rendered.reason };
  }
  // rendered.status is 'render_timeout' or 'unavailable' -- fall through
  // to the optional external endpoint below only for 'unavailable'
  // (the renderer itself couldn't run here); a timeout means MovieMint
  // was reached and just didn't produce data in time, which an external
  // service hitting the same URL wouldn't fix either, so that's reported
  // as render_required directly instead of spending another request.
  if (rendered.status === 'render_timeout') {
    return { status: 'render_required', path, snippet: rendered.snippet };
  }

  // --- Tier 3: optional external render endpoint (fallback only) ------
  await politeWait();
  const viaEndpoint = await fetchViaRenderEndpoint(path);
  if ('html' in viaEndpoint) {
    if (looksLikeInteractiveChallenge(viaEndpoint.html)) {
      return { status: 'blocked', path, reason: 'interactive challenge detected on rendered response' };
    }
    if (looksLikeRealData(viaEndpoint.html)) {
      return { status: 'ok', html: viaEndpoint.html, via: 'render-endpoint' };
    }
    return { status: 'error', path, message: 'rendered response (external endpoint) still had no recognizable data' };
  }

  if (viaEndpoint.error === 'MOVIEMINT_RENDER_ENDPOINT not configured') {
    // Local rendering was 'unavailable' in this environment and there's no
    // fallback configured -- be explicit about which of the two problems
    // this is, rather than collapsing both into render_required.
    return { status: 'error', path, message: `local renderer unavailable (${rendered.reason}); no MOVIEMINT_RENDER_ENDPOINT configured` };
  }
  return { status: 'error', path, message: viaEndpoint.error };
}
