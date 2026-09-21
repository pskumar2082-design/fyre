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
        // Premium dark theme inspired by MovieMint's own tracker UI
        // (moviemintbo.com) -- near-black canvas, zinc-toned cards, one
        // disciplined accent color (mint green) reserved for money
        // figures, live status and primary actions. Every existing
        // className (bg-surface, text-textDim, border-border, bg-gold,
        // ...) picks up the new look automatically, no per-file renames
        // needed -- this file is the single place the whole site's
        // palette lives.
        bg: '#0A0A0A',
        bgAlt: '#111113',
        surface: '#141416',
        surface2: '#1A1B1E',
        border: '#27272A', // zinc-800
        gold: '#00E18C',       // primary accent -- MovieMint's exact tracker green
        goldBright: '#34F5A8', // brighter green for hover/emphasis states
        goldDim: '#00E18C',    // same hue -- always used at low opacity (bg-goldDim/10) for tints
        red: '#F65A5A',        // negative / error
        text: '#FFFFFF',       // headings
        textDim: '#A1A1AA',    // zinc-400 -- body / secondary text
        textFaint: '#71717A',  // zinc-500 -- muted labels, placeholders
        // Gradient-text stops (.gtext) -- deep green -> bright mint,
        // staying inside the tracker-green palette instead of the old
        // blue/teal run.
        brandPurple: '#00B673',
        brandPink: '#00E18C',
        brandOrange: '#6FFFC0',
        positive: '#00E18C',
        coral: '#FF6B8B',
        chartBlue: '#00E18C',
        chartTeal: '#34F5A8',
        tintBlue: '#141416',
        tintPink: '#1A1416',
        tintYellow: '#1A1712',
        tintTeal: '#0F1A17'
      },
      // Keep the same radius scale the app already uses everywhere.
      borderRadius: {
        lg: '15px',
        xl: '20px',
        '2xl': '25px'
      },
      boxShadow: {
        // A dark canvas needs depth from a border + soft black falloff,
        // not a visible drop shadow -- see .Card's border-white/5.
        card: '0 10px 30px -10px rgba(0,0,0,0.7)'
      },
      fontFamily: {
        display: ['"Inter"', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      }
    }
  },
  plugins: []
};
