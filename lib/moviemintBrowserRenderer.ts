import type { Browser, Page } from 'puppeteer-core';
import { DATA_MARKERS, INTERACTIVE_CHALLENGE_MARKERS } from '@/lib/moviemintChallengeMarkers';

// ---------------------------------------------------------------------------
// Local, $0 headless-Chromium rendering for MovieMint pages: puppeteer-core
// (no bundled browser, stays tiny) + @sparticuz/chromium (a Chromium
// binary built specifically to run inside AWS Lambda/Vercel-style
// serverless functions -- MIT licensed, no external service, no API key,
// no per-request cost beyond this function's own compute time).
//
// See next.config.js for the two settings this requires to actually work
// once deployed (serverComponentsExternalPackages + outputFileTracingIncludes)
// and app/api/*-sync-moviemint/route.ts for `export const runtime = 'nodejs'`
// (this cannot run under the Edge runtime -- it's a native binary).
//
// Browser lifecycle, per the brief this was built against: ONE Chromium
// process per sync run, reused across every movie.
//   launch browser (lazy, on first use)
//     -> renderMovieMintPage() opens + closes its OWN Page per call
//     -> syncMovieMint.ts calls closeSharedBrowser() in a finally block
//        once the whole run is done
// A render call never launches or closes the Browser itself -- only
// closeSharedBrowser() does, and only the orchestrator calls that.
//
// Behavior, per the brief:
//   - open the permitted public URL (caller already validated the path)
//   - allow normal JS execution, wait for the page's own data to appear
//   - read the rendered DOM (page.content())
//   - if an INTERACTIVE challenge appears, abort immediately -- no
//     interaction, no token handling, ever -- and report it as 'blocked'
//   - never touch /api/ or an internal MovieMint endpoint (the caller,
//     moviemintClient.ts, is what enforces the path allowlist; this
//     module just renders whatever full URL it's given, so that
//     allowlist check happening upstream is load-bearing)
// ---------------------------------------------------------------------------

export const NAVIGATION_TIMEOUT_MS = 15000; // strict: fail fast rather than hang a sync run

// How long to wait for the page's own JS to populate real data.
//
// Measured directly against the live site (2026-09-20, via a real browser):
// moviemintbo.com runs its own branded loading animation ("FINALIZING
// DASHBOARD NN%") before the real box-office numbers mount -- on that
// measurement, real data appeared ~4.8s after navigation start.
//
// That figure does NOT hold on Vercel. Two production runs in a row --
// at 12000ms, then at 25000ms -- both timed out, and both times the
// diagnostic snippet captured moments later already showed real data
// ("GROSS ... TICKETS ... SHOWS"): consistent near-misses, not a broken
// render. A third run at 30000ms ALSO timed out the same way. Rather than
// keep nudging this up by small increments and re-missing, jumping to a
// decisively larger margin -- the real per-render budget is no longer
// tight (HARD_MAX_DURATION_MS in syncMovieMint.ts is 280000ms, Vercel
// Hobby's real max duration, not the 60000ms originally assumed here), so
// there's no cost to being generous. One plausible reason production
// specifically (not a normal browser) runs this much slower: Cloudflare's
// own non-interactive "challenge-platform" verification call (visible in
// this renderer's network activity, distinct from any interactive
// CAPTCHA -- see moviemintChallengeMarkers.ts) may simply take longer to
// clear from Vercel's datacenter IP ranges than from an ordinary
// residential browser IP.
export const DATA_WAIT_TIMEOUT_MS = 60000;

// A realistic desktop UA -- distinct from the plain-HTTP tier's
// self-identifying bot UA, because this IS a real browser rendering the
// page exactly as an ordinary visitor's would; MovieMint's own robots.txt
// governs which paths are fair game (enforced by the caller), not what
// this renders once on an allowed path.
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// /tracked is an infinite-scroll listing (84 movies total, ~12 rendered
// on initial load per live investigation, 2026-09-20) -- everything past
// that first screenful only exists in the DOM after JS-driven scroll
// events load more. A caller asks for this via renderMovieMintPage's
// scrollRounds option; each round scrolls to the bottom and gives the
// page a moment to fetch/mount the next batch before the next round.
// Modest per-round wait: unlike the initial full-page data load (which
// can take MovieMint/Cloudflare tens of seconds, see DATA_WAIT_TIMEOUT_MS
// above), loading one more batch into an already-hydrated list is a much
// smaller amount of work, so a short fixed wait plus a "did the page get
// taller" check is enough without ballooning render time.
const SCROLL_STEP_WAIT_MS = 1200;

export type BrowserRenderResult =
  | { status: 'ok'; html: string }
  // `snippet`: the first ~300 chars of document.body.innerText at the
  // moment we gave up -- e.g. still "FINALIZING DASHBOARD 42%" (genuinely
  // just slow), an empty/near-empty body (JS never ran or errored), or
  // something else entirely. Without this, a timeout is a dead end to
  // diagnose from server logs alone.
  | { status: 'render_timeout'; snippet: string }
  | { status: 'blocked'; reason: string }
  | { status: 'unavailable'; reason: string }; // Chromium couldn't launch/run in this environment

let sharedBrowserPromise: Promise<Browser> | null = null;

async function launchBrowser(): Promise<Browser> {
  // Dynamically imported so merely importing this module (or anything
  // that transitively imports it, e.g. in a test file) never tries to
  // load native Chromium bindings unless a render is actually attempted.
  const [{ default: puppeteer }, { default: chromium }] = await Promise.all([
    import('puppeteer-core'),
    import('@sparticuz/chromium')
  ]);

  const executablePath = await chromium.executablePath();

  // This @sparticuz/chromium version no longer exposes defaultViewport/
  // headless statics (only args, graphics/setGraphicsMode and
  // executablePath -- checked against the installed package's own
  // index.d.ts rather than assumed). `headless: true` plus a small fixed
  // viewport is exactly what a text-content render like this needs; no
  // WebGL/graphics-dependent rendering happens on this page.
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 1024 },
    executablePath,
    headless: true
  });
}

async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = launchBrowser();
    // If launching fails, clear the cached promise so a later call in the
    // same run can retry instead of permanently reusing a rejected promise.
    sharedBrowserPromise.catch(() => {
      sharedBrowserPromise = null;
    });
  }
  return sharedBrowserPromise;
}

// syncMovieMint.ts calls this exactly once, in a finally block, at the end
// of a sync run -- never per movie.
export async function closeSharedBrowser(): Promise<void> {
  const promise = sharedBrowserPromise;
  sharedBrowserPromise = null;
  if (!promise) return;
  try {
    const browser = await promise;
    await browser.close();
  } catch {
    // Never launched, or already gone -- nothing to clean up.
  }
}

export async function renderMovieMintPage(
  url: string,
  opts: { scrollRounds?: number } = {}
): Promise<BrowserRenderResult> {
  const scrollRounds = opts.scrollRounds ?? 0;
  let browser: Browser;
  try {
    browser = await getSharedBrowser();
  } catch (err: any) {
    return { status: 'unavailable', reason: err?.message ?? String(err) };
  }

  let page: Page | null = null;
  try {
    page = await browser.newPage();
    await page.setUserAgent(BROWSER_USER_AGENT);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });

    // Let the page's own JS run and fetch/hydrate its data -- poll for
    // one of the confirmed data markers rather than a fixed sleep, so a
    // fast render doesn't wait longer than it has to and a slow one
    // doesn't get cut off early.
    try {
      await page.waitForFunction(
        (markers: string[]) => markers.some((m) => document.body && document.body.innerText.includes(m)),
        { timeout: DATA_WAIT_TIMEOUT_MS },
        DATA_MARKERS
      );
    } catch {
      // Timed out waiting -- fall through and check what actually
      // rendered (could be a slow page, could be a challenge).
    }

    if (scrollRounds > 0) {
      let lastHeight = await page.evaluate(() => document.body.scrollHeight).catch(() => 0);
      for (let round = 0; round < scrollRounds; round++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
        await new Promise((r) => setTimeout(r, SCROLL_STEP_WAIT_MS));
        const newHeight = await page.evaluate(() => document.body.scrollHeight).catch(() => lastHeight);
        if (newHeight <= lastHeight) break; // page stopped growing -- reached the end of the list
        lastHeight = newHeight;
      }
    }

    const html = await page.content();
    // Case-insensitive on purpose -- see moviemintClient.ts's containsAny()
    // for the full story: MovieMint's data labels render as uppercase via
    // CSS (Tailwind's `uppercase` class), but the raw text node value
    // serialized into page.content() is title-case ("Gross"), so an
    // exact-case check against 'GROSS' never matched here even when the
    // real data had already loaded. Confirmed directly against the live
    // DOM on 2026-09-20 after multiple production runs all reported
    // "timed out" despite the diagnostic snippet (which reads
    // document.body.innerText, CSS-aware) showing real data present.
    const htmlLower = html.toLowerCase();

    if (INTERACTIVE_CHALLENGE_MARKERS.some((m) => htmlLower.includes(m.toLowerCase()))) {
      return { status: 'blocked', reason: 'interactive challenge detected on rendered page' };
    }
    if (!DATA_MARKERS.some((m) => htmlLower.includes(m.toLowerCase()))) {
      const snippet = await page
        .evaluate(() => (document.body ? document.body.innerText.slice(0, 300) : '(no body)'))
        .catch((err) => `(could not read body text: ${err?.message ?? err})`);
      return { status: 'render_timeout', snippet };
    }
    return { status: 'ok', html };
  } catch (err: any) {
    return { status: 'unavailable', reason: err?.message ?? String(err) };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}
