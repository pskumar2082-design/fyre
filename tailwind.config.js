/** @type {import('tailwindcss').Config} */

// ---------------------------------------------------------------------------
// Fyre design tokens -- the site's ONE source of truth for color, radius and
// shadow. This is the poster's own dark navy/blue palette
// (lib/poster/blocks.tsx), promoted from "the thing exported PNGs look
// like" to "the thing the whole product looks like": the site was a light
// "Car Rent"-style theme before this pass (see the git history on this
// file), with the poster already using these exact navy/gold/goldDim/red
// values independently. Rather than inventing a new palette, this reuses
// the poster's calibrated one so the website and every generated graphic
// are visibly the same product.
//
// Elevation scale (dark UI convention: each step lighter = "closer to the
// viewer"), reused via the constants below rather than repeated hex:
//   bgAlt   -- sunken panel, a touch DARKER than bg (e.g. homepage stats rail)
//   bg      -- page background (== navy, the poster's own background)
//   surface -- card background (== navyAlt, one step up)
//   surface2 / surfaceHigh / surfaceTop -- progressively lighter elevated
//     surfaces (inputs, hover fills, thumbnail placeholders, and headroom
//     for anything that needs to sit above a card later)
// ---------------------------------------------------------------------------
const navy = '#14161C';
const navyAlt = '#1D2029';
const surface2 = '#242733';
const surfaceHigh = '#2B2F3D';
const surfaceTop = '#333748';
const bgAlt = '#0E0F13';

// Thin, low-contrast translucent-white borders -- work on top of any of the
// surfaces above without needing a matching hex per elevation step. Exactly
// the poster's own BORDER value.
const border = 'rgba(255,255,255,0.10)';
const borderStrong = 'rgba(255,255,255,0.18)';

// Soft white (not harsh pure white) for high-emphasis text, plus the
// poster's own translucent-white secondary/muted tiers.
const text = '#F2F3F5';
const textDim = 'rgba(255,255,255,0.62)';
const textFaint = 'rgba(255,255,255,0.38)';

// The Fyre blue -- unchanged; this already matched the poster before this
// pass. goldBright now lightens ON HOVER (a filled blue button, or blue
// hover-text) instead of darkening -- darkening a saturated accent against
// a dark background loses contrast instead of adding it.
const gold = '#2F6FED';
const goldBright = '#5B93FF';
const goldDim = '#22C55E'; // green -- positive / "completed" states
const red = '#EF4444';
// New: the poster's amber mid-occupancy tier didn't have a website token
// yet (the live site had no occupancy-threshold coloring outside the
// admin poster tool). Centralizing it here per the design-system brief
// rather than letting a future occupancy-colored view invent its own.
const amber = '#F59E0B';
// A deliberate secondary accent, distinct from the primary blue, already
// used (as raw Tailwind `indigo-500/600`) to tell the homepage's "Now
// Showing" stat apart from its "Advance" (blue) stat. Promoted to a
// calibrated token instead of Tailwind's stock indigo swatch, which was
// tuned for a light UI and read slightly too saturated/cartoonish here.
const indigo = '#6C7BF0';
// The review-star rating color -- previously hardcoded as a raw hex
// (#F6A609) independently in app/page.tsx, app/reviews/page.tsx and
// components/NowShowing.tsx. Same exact value, just centralized: "no
// hardcoded page-specific colors" applies to every color on the site,
// not only the ones this pass happened to touch first. Deliberately its
// own token rather than reusing `amber` (#F59E0B) -- close but not the
// same hex, and a rating star and an occupancy-percentage warning are
// different pieces of meaning that shouldn't be forced to share a color
// just because they're visually similar.
const star = '#F6A609';

module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: navy,
        bgAlt,
        surface: navyAlt,
        surface2,
        surfaceHigh,
        surfaceTop,
        border,
        borderStrong,

        // Still their own tokens (not just aliases of bg/surface) since
        // AppShell's sidebar references them by name for its permanently-
        // dark treatment -- they happen to equal bg/surface now that the
        // whole app is dark, but keeping them distinct means a future
        // "sidebar should read one step off from the page" tweak is a
        // one-line change instead of an aliasing untangle.
        navy,
        navyAlt,

        gold,
        goldBright,
        goldDim,
        red,
        amber,
        indigo,
        star,

        text,
        textDim,
        textFaint,

        // Not used anywhere live (only the orphaned components/VersionSelector.tsx
        // and components/BreakdownTable.tsx -- neither is imported by any
        // page). Kept pointed at the new dark tokens so nothing looks
        // broken if either is ever wired back up.
        brandPurple: indigo,
        brandPink: goldDim,
        brandOrange: goldBright,
        positive: goldDim,
        coral: red,
        chartBlue: gold,
        chartTeal: goldDim,
        tintBlue: surface2,
        tintPink: surface2,
        tintYellow: surface2,
        tintTeal: surface2
      },
      // Dialed back from the previous 15/20/25px scale -- restrained radii
      // read as premium/data-focused (the poster's own table/card corners
      // are 16px); the old scale was closer to a generic soft SaaS look.
      borderRadius: {
        lg: '10px',
        xl: '14px',
        '2xl': '18px'
      },
      // A single restrained shadow, not a family of them -- per the design
      // brief, hierarchy on this dark UI comes from surface/border
      // contrast first, with just enough shadow to lift a card off the
      // page behind it, never a "giant shadow" or colored glow.
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.3), 0 8px 20px -12px rgba(0,0,0,0.5)'
      },
      // Public Sans stands in for Walmart's proprietary "Everyday Sans"
      // (brand-restricted, not available outside Walmart) -- see
      // globals.css's @import comment for why. `stat` (money/gross
      // figures) is Walmart's "Inline Header" tier -- Bold Public Sans,
      // same face as everything else, emphasis carried by weight/color
      // rather than a separate condensed cut. `mono` is Walmart's
      // "Data + Code" tier (Everyday Sans Mono in their system) --
      // overrides Tailwind's own default mono stack so the existing
      // `font-mono` utility already carries the right face; used on
      // genuinely tabular numeric columns (see TableGroups.tsx).
      fontFamily: {
        display: ['"Public Sans"', 'sans-serif'],
        body: ['"Public Sans"', 'sans-serif'],
        heading: ['"Public Sans"', 'sans-serif'],
        stat: ['"Public Sans"', 'sans-serif'],
        mono: ['"Noto Sans Mono"', 'monospace']
      }
    }
  },
  plugins: []
};
