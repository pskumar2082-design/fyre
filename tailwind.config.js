/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Light theme, matching the "Car Rent" dashboard reference exactly:
        // white main content, a warm cream secondary panel, a dark navy
        // sidebar (the one region that stays dark), and a solid blue
        // accent. Token NAMES are kept the same as the dark-theme pass so
        // every component that already reads bg/surface/text/gold/etc
        // picks up the new values automatically -- only the sidebar/header
        // split needed real file edits (see AppShell.tsx), since a
        // permanent dark sidebar next to light content has no single-value
        // token that covers both.
        bg: '#FFFFFF',       // page / main content background
        bgAlt: '#F6F4F0',    // warm cream secondary panel (stats column)
        surface: '#FFFFFF',  // card background
        surface2: '#F8F9FB', // nested / hover row tint
        surfaceHigh: '#FFFFFF',
        surfaceTop: '#FFFFFF',
        border: '#E7E5E0',   // hairline border/divider

        // The sidebar is the one part of the page that stays dark --
        // doesn't fit the bg/bgAlt system above, so it gets its own
        // dedicated tokens instead of overloading an existing one.
        navy: '#14161C',
        navyAlt: '#1D2029',

        gold: '#2F6FED',       // primary blue accent
        goldBright: '#1D5FE0', // darker blue -- hover/pressed on a filled blue element
        goldDim: '#22C55E',    // secondary accent (green) -- positive/"completed" states
        red: '#EF4444',        // error / negative / urgent state

        text: '#111827',      // near-black, high-emphasis text
        textDim: '#6B7280',   // medium gray, secondary text
        textFaint: '#9CA3AF', // light gray, faint/placeholder text

        // Not used anywhere live (only the orphaned VersionSelector.tsx) --
        // kept pointed at the same system so nothing breaks if it's ever
        // wired back up.
        brandPurple: '#2F6FED',
        brandPink: '#22C55E',
        brandOrange: '#1D5FE0',
        positive: '#22C55E',
        coral: '#EF4444',
        chartBlue: '#2F6FED',
        chartTeal: '#22C55E',
        tintBlue: '#F6F4F0',
        tintPink: '#F6F4F0',
        tintYellow: '#F6F4F0',
        tintTeal: '#F6F4F0'
      },
      borderRadius: {
        lg: '15px',
        xl: '20px',
        '2xl': '25px'
      },
      boxShadow: {
        card: '0 4px 24px -4px rgba(20,22,28,0.08)'
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
