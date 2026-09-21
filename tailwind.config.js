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
        // Monochromatic Minimalism -- the user's own palette, used
        // literally rather than approximated: a charcoal canvas, two
        // grays of text, a dark-gray border, and one muted gray accent
        // for interactive chrome (buttons, links, active states). No hue
        // anywhere -- hierarchy comes from value (how light/dark) and
        // typography, not color, which is the whole point of this
        // palette and also settles the "looks copied" complaint for
        // good: nothing here matches another tracker's brand color.
        bg: '#121212',
        bgAlt: '#161616',
        surface: '#1A1A1A',
        surface2: '#202020',
        border: '#444444',
        gold: '#888888',       // "Accent" in the given palette -- interactive chrome only
        goldBright: '#A8A8A8', // lighter gray for hover/emphasis
        goldDim: '#888888',
        red: '#F65A5A',        // errors stay a real color -- can't signal "this failed" in grayscale
        text: '#E0E0E0',       // Primary Text
        textDim: '#B0B0B0',    // Secondary Text
        textFaint: '#777777',  // dimmer still, for captions/placeholders
        // .gtext stays inside the grayscale range -- light gray fading
        // to the accent gray, not a color gradient.
        brandPurple: '#E0E0E0',
        brandPink: '#B0B0B0',
        brandOrange: '#888888',
        positive: '#E0E0E0',
        coral: '#B0B0B0',
        chartBlue: '#E0E0E0',
        chartTeal: '#B0B0B0',
        tintBlue: '#1A1A1A',
        tintPink: '#1A1A1A',
        tintYellow: '#1A1A1A',
        tintTeal: '#1A1A1A'
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
        display: ['"Inter"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        // Bold condensed display face for headings (see .hdisplay in
        // globals.css) and a tall condensed face specifically for big
        // stat/money figures -- matches the two type styles in the
        // reference screenshots.
        heading: ['"Anton"', 'sans-serif'],
        stat: ['"Bebas Neue"', 'sans-serif']
      }
    }
  },
  plugins: []
};
