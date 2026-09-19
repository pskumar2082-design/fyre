/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Flat, high-contrast cinematic theme (moviemintbo.com's layout
        // language, our own purple/pink accent instead of their green) —
        // solid dark panels, not glass. Token names (gold/goldBright/
        // goldDim) are kept as-is so every existing className in the app
        // picks up color changes automatically.
        bg: '#07040F',
        bgAlt: '#0C0818',
        surface: '#140F24',
        surface2: '#1C1430',
        border: '#2C2247',
        gold: '#A855F7',
        goldBright: '#E879F9',
        goldDim: '#4C1D95',
        red: '#EF4444',
        text: '#F5F3FF',
        textDim: '#A79BC7',
        textFaint: '#6B5D8A',
        // Extra stops for the multi-color gradient text treatment.
        brandPurple: '#6366F1',
        brandPink: '#F472B6',
        brandOrange: '#FB923C'
      },
      fontFamily: {
        display: ['"Inter"', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      }
    }
  },
  plugins: []
};
