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
// measurement, real data appeared ~4.8s after navigation start. That's
// comfortably under a short timeout in a normal browser, but this renders
// inside a Vercel serverless function with far less CPU than a desktop
// browser, and the very first production run of this renderer timed out
// at the previous 12000ms value (status: 'render_required' with no
// interactive-challenge markers present -- i.e. genuinely still loading,
// not blocked). Raised with real margin rather than guessed.
export const DATA_WAIT_TIMEOUT_MS = 25000;

// A realistic desktop UA -- distinct from the plain-HTTP tier's
// self-identifying bot UA, because this IS a real browser rendering the
// page exactly as an ordinary visitor's would; MovieMint's own robots.txt
// governs which paths are fair game (enforced by the caller), not what
// this renders once on an allowed path.
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

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

export async function renderMovieMintPage(url: string): Promise<BrowserRenderResult> {
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

    const html = await page.content();

    if (INTERACTIVE_CHALLENGE_MARKERS.some((m) => html.includes(m))) {
      return { status: 'blocked', reason: 'interactive challenge detected on rendered page' };
    }
    if (!DATA_MARKERS.some((m) => html.includes(m))) {
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
