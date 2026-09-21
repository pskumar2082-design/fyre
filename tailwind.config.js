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
        // Google's actual Material Design dark theme, implemented literally
        // rather than approximated -- this replaces two rounds of invented
        // palettes (a MovieMint-matched green, then a custom ember-orange,
        // then a flat monochrome gray) with the spec's own values.
        //
        // ELEVATION: dark theme surfaces are the #121212 base lightened by a
        // semi-transparent WHITE overlay that gets stronger the "higher" a
        // surface sits, not a black drop shadow. These are the spec's own
        // dp-to-overlay values (00dp 0%, 01dp 5%, 02dp 7%, 04dp 9%, 08dp 12%,
        // 24dp 16%) pre-blended onto #121212 so they work as flat Tailwind
        // colors.
        bg: '#121212',          // 00dp -- page background
        bgAlt: '#1E1E1E',       // 01dp -- permanent nav rail (low elevation, per spec)
        surface: '#222222',     // 02dp -- base cards
        surface2: '#262626',    // 04dp -- nested rows / hover surfaces
        surfaceHigh: '#2E2E2E', // 08dp -- sticky header, dropdowns, toasts
        surfaceTop: '#383838',  // 24dp -- modals, the mobile drawer overlay
        border: 'rgba(255,255,255,0.12)', // spec's own divider value: 12% white

        // Primary/secondary/error straight from Google's own Material dark
        // theme reference palette -- not a color I'm picking, the one their
        // docs use as the canonical example. Primary is deliberately a
        // light, desaturated 200-tone (not a saturated brand color) so it
        // clears the spec's 4.5:1 contrast requirement against #121212 and
        // pairs with black text/icons on top of it.
        gold: '#BB86FC',       // primary
        goldBright: '#D1A9FF', // primary, lighter -- hover/emphasis
        goldDim: '#03DAC6',    // secondary (teal) -- second accent, e.g. "advance" state
        red: '#CF6679',        // spec's own baseline dark-theme error color

        // On-surface text at the spec's own opacity tiers, applied to white
        // rather than picking gray hex values -- 87% high emphasis, 60%
        // medium/hint, 38% disabled/faint.
        text: 'rgba(255,255,255,0.87)',
        textDim: 'rgba(255,255,255,0.60)',
        textFaint: 'rgba(255,255,255,0.38)',

        // Not used anywhere live (only the orphaned VersionSelector.tsx) --
        // kept pointed at the same system so nothing breaks if it's ever
        // wired back up.
        brandPurple: '#BB86FC',
        brandPink: '#03DAC6',
        brandOrange: '#3700B3',
        positive: '#03DAC6',
        coral: '#CF6679',
        chartBlue: '#BB86FC',
        chartTeal: '#03DAC6',
        tintBlue: '#1E1E1E',
        tintPink: '#1E1E1E',
        tintYellow: '#1E1E1E',
        tintTeal: '#1E1E1E'
      },
      borderRadius: {
        lg: '15px',
        xl: '20px',
        '2xl': '25px'
      },
      boxShadow: {
        card: '0 10px 30px -10px rgba(0,0,0,0.7)'
      },
      fontFamily: {
        // Roboto is Material Design's own system typeface -- switching to it
        // (from Inter/Anton/Bebas Neue) makes the type match the spec too,
        // not just the colors. Roboto Condensed carries the dense numeric
        // figures (money/stats), the same role Bebas Neue played, but stays
        // inside the same type family instead of mixing in an unrelated
        // display face.
        display: ['Roboto', 'sans-serif'],
        body: ['Roboto', 'sans-serif'],
        heading: ['Roboto', 'sans-serif'],
        stat: ['"Roboto Condensed"', 'sans-serif']
      }
    }
  },
  plugins: []
};
