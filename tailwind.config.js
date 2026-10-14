/** @type {import('tailwindcss').Config} */

// ---------------------------------------------------------------------------
// Fyre design tokens -- the site's ONE source of truth for color, radius,
// shadow and type. Redesign (2026-10): black + zinc cinematic system,
// measured from the frameXTV reference screenshots (pixel-sampled):
//   page            #000000   (header + page background are pure black)
//   surface         #09090b   zinc-950 (cards, header pills)
//   surface2        #18181b   zinc-900 (secondary buttons, chips, inputs)
//   border          #27272a   zinc-800 (cards, posters, pills)
//   borderStrong    #3f3f46   zinc-700 (hovered borders, hero buttons)
//   text            #fafafa / zinc-400 / zinc-500 tiers
//   accent          amber-400 (#fbbf24) -- ratings in the reference, the
//                   headline gross / highlight figures in Fyre
//   primary action  solid white with black text (see components/ui.tsx)
// Token NAMES are unchanged (bg, surface, gold, textDim, ...) so every
// existing page picks the new system up without per-file rewrites.
// ---------------------------------------------------------------------------
const black = '#000000';
const zinc950 = '#09090b';
const zinc900 = '#18181b';
const zinc800 = '#27272a';
const zinc700 = '#3f3f46';

const border = zinc800;
const borderStrong = zinc700;

const text = '#fafafa';
const textDim = '#a1a1aa'; // zinc-400
const textFaint = '#71717a'; // zinc-500

// Accent (historical token name `gold`): amber-400, hover amber-300.
const gold = '#fbbf24';
const goldBright = '#fcd34d';
const goldDim = '#22C55E'; // green -- positive / "completed" states
const red = '#EF4444';
const amber = '#F59E0B'; // occupancy warning tier
const indigo = '#818CF8';
const sky = '#38BDF8';
const violet = '#A78BFA';
const star = '#fbbf24';

module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: black,
        bgAlt: zinc950,
        surface: zinc950,
        surface2: zinc900,
        surfaceHigh: zinc800,
        surfaceTop: zinc700,
        border,
        borderStrong,
        navy: black,
        navyAlt: zinc950,

        gold,
        goldBright,
        goldDim,
        red,
        amber,
        indigo,
        sky,
        violet,
        star,

        text,
        textDim,
        textFaint,

        // Legacy aliases (orphaned components only), kept on-palette.
        brandPurple: indigo,
        brandPink: goldDim,
        brandOrange: goldBright,
        positive: goldDim,
        coral: red,
        chartBlue: sky,
        chartTeal: goldDim,
        tintBlue: zinc900,
        tintPink: zinc900,
        tintYellow: zinc900,
        tintTeal: zinc900
      },
      // Tailwind's stock radii (6 / 8 / 12 / 16px) -- the same scale the
      // reference uses (--radius-md .375rem, -lg .5rem, -xl .75rem).
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.5)',
        lift: '0 18px 40px -16px rgba(0,0,0,0.8)'
      },
      // System UI stack (San Francisco on Apple, Segoe UI on Windows,
      // Roboto on Android) -- the reference ships no web font. Mono is the
      // platform monospace (SF Mono / Menlo / Consolas) used for badges,
      // metadata and counts. Serif for taglines.
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', '"Noto Sans"', 'Arial', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        body: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', '"Noto Sans"', 'Arial', 'sans-serif'],
        heading: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        stat: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
        serif: ['ui-serif', 'Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif']
      }
    }
  },
  plugins: []
};
