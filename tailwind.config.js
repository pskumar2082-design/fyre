/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // BankDash (Figma "BankDash - Dashboard UI Kit - Admin Template")
        // light theme, mapped onto the same semantic token names the app
        // already used for its old dark purple/pink theme -- every existing
        // className (bg-surface, text-textDim, border-border, bg-gold, ...)
        // picks up the new look automatically, no per-file renames needed.
        bg: '#F5F7FA',
        bgAlt: '#EDF0F7',
        surface: '#FFFFFF',
        surface2: '#F0F3F9',
        border: '#DFEAF2',
        gold: '#1814F3',       // primary accent (BankDash's active/brand blue)
        goldBright: '#2D60FF', // secondary accent blue, used for emphasis/links
        goldDim: '#1814F3',    // same hue -- always used at low opacity (bg-goldDim/15) for tints
        red: '#FF4B4A',        // negative / error
        text: '#343C6A',       // headings
        textDim: '#718EBF',    // body / secondary text
        textFaint: '#8BA3CB',  // muted labels, placeholders
        // Gradient-text stops (.gtext) -- blue -> teal instead of the old
        // violet -> pink -> orange run, staying inside BankDash's palette.
        brandPurple: '#1814F3',
        brandPink: '#2D60FF',
        brandOrange: '#16DBCC',
        // Extra BankDash tokens used by chart/stat/badge treatments.
        positive: '#16DBAA',
        coral: '#FE5C73',
        chartBlue: '#1814F3',
        chartTeal: '#16DBCC',
        tintBlue: '#E7EDFF',
        tintPink: '#FFE0EB',
        tintYellow: '#FFF5D9',
        tintTeal: '#DCFAF8'
      },
      // BankDash's radius scale (cards 25px / rows 20px / fields 15px) laid
      // directly over Tailwind's own lg/xl/2xl steps, since the app already
      // uses those class names consistently for exactly those three tiers.
      borderRadius: {
        lg: '15px',
        xl: '20px',
        '2xl': '25px'
      },
      boxShadow: {
        card: '0 4px 18px -2px rgba(231,228,232,0.8)'
      },
      fontFamily: {
        display: ['"Inter"', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      }
    }
  },
  plugins: []
};
