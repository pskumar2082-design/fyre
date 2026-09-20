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

// Signs real MovieMint data actually made it into a response.
export const DATA_MARKERS = ['GROSS', 'TICKETS SOLD', 'OCCUPANCY'];

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
