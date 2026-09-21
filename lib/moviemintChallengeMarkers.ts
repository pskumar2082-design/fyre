// ---------------------------------------------------------------------------
// Shared between moviemintClient.ts (plain HTTP) and
// moviemintBrowserRenderer.ts (local headless-Chromium render) so both
// retrieval paths agree on exactly the same two things:
//   - what counts as "real data arrived" (DATA_MARKERS)
//   - what counts as an INTERACTIVE challenge that must stop the request,
//     not be worked around (INTERACTIVE_CHALLENGE_MARKERS)
// Keeping these in one file means a change to either definition can't
// accidentally drift between the two renderers.
// ---------------------------------------------------------------------------

// Signs real MovieMint data actually made it into a response. Used by
// moviemintBrowserRenderer.ts against the RENDERED page's visible
// document.body.innerText -- a plain "did this word appear on screen"
// check that's fine there, since innerText only contains what actually
// rendered.
export const DATA_MARKERS = ['GROSS', 'TICKETS SOLD', 'OCCUPANCY'];

// Tier 1 (plain HTTP, see moviemintClient.ts) reads MovieMint's raw,
// un-rendered SSR response -- and confirmed live (2026-09-21) that its
// <head> meta description/keywords routinely contain the bare words
// "gross"/"occupancy" in ordinary prose (e.g. "...day-wise gross, advance
// sales...") even when NO real box-office data has loaded yet. Matching
// DATA_MARKERS there is a false positive: it reported /advance and a
// movie detail page as `ok` with zero usable data, when what's actually
// present is just the pre-render loading shell.
//
// Real data, when it IS present in tier 1's raw response, arrives as a
// Next.js Flight payload embedded inside self.__next_f.push(...) calls,
// where a field always appears as an escaped JSON key -- e.g.
// "gross":129985597.46 -- a pattern ordinary description text can't
// produce by coincidence. Tier 1 requires this stronger signal instead.
export const RAW_HTML_DATA_MARKERS = ['\\"gross\\":', '\\"lifetimeGross\\":', '\\"ticketsSold\\":'];

// Signs of an actual INTERACTIVE challenge -- a puzzle or checkbox a human
// would need to solve. Deliberately does NOT include Cloudflare's passive
// background bot-management script tags, which every normal visitor's
// browser (headless or not) loads and passes without any interaction --
// that's not what either retrieval path is being asked to avoid.
export const INTERACTIVE_CHALLENGE_MARKERS = [
  'Attention Required! | Cloudflare',
  'Checking your browser before accessing',
  'g-recaptcha',
  'h-captcha',
  'hcaptcha.com',
  'Please complete the security check',
  'id="challenge-form"',
  'Verify you are human',
  // Seen live on production (2026-09-20), on /tracked specifically -- a
  // full-page Cloudflare interstitial, not the passive background script
  // this list otherwise deliberately excludes. Wording is specific to
  // Cloudflare's own verification page, not phrasing MovieMint's own UI
  // would plausibly use, so this is a safe, low-false-positive addition.
  'Performing security verification',
  'verifies you are not a bot',
  'protect against malicious bots'
];
