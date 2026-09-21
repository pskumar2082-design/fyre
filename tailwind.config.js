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
        // Dark theme built around fyre's own mark -- a flame -- instead
        // of borrowing another tracker's exact brand color. Near-black
        // canvas, neutral zinc-toned cards, and one accent: ember
        // orange, reserved for money figures, live status and primary
        // actions. Every existing className (bg-surface, text-textDim,
        // border-border, bg-gold, ...) picks up the new palette
        // automatically -- this file is the single place it all lives.
        bg: '#0C0B0A',
        bgAlt: '#131210',
        surface: '#161513',
        surface2: '#1C1B18',
        border: '#2A2825', // warm-tinted zinc-800
        gold: '#FF7A1A',       // primary accent -- ember/flame orange
        goldBright: '#FFA245', // brighter amber for hover/emphasis states
        goldDim: '#FF7A1A',    // same hue -- always used at low opacity (bg-goldDim/10) for tints
        red: '#F65A5A',        // negative / error
        text: '#FFFFFF',       // headings
        textDim: '#A8A29A',    // warm-tinted gray -- body / secondary text
        textFaint: '#78726A',  // muted labels, placeholders
        // Gradient-text stops (.gtext) -- ember red -> orange -> gold,
        // an actual flame gradient instead of a cool blue/teal run.
        brandPurple: '#E8460F',
        brandPink: '#FF7A1A',
        brandOrange: '#FFC94D',
        positive: '#FF7A1A',
        coral: '#FF6B8B',
        chartBlue: '#FF7A1A',
        chartTeal: '#FFC94D',
        tintBlue: '#161513',
        tintPink: '#1A1416',
        tintYellow: '#1A1712',
        tintTeal: '#171310'
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
