/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // R-23 (design review 2026-07-01): the legacy Apple-era extend block
    // (brand/surface/content/status palettes incl. the wrong semantic
    // expansion/contraction pair, apple shadows/radii/animations/fontSize
    // scale) was deleted — zero generated classes were in use. Theme tokens
    // live in lib/theme.ts; fonts ship via next/font in app/layout.tsx.
    extend: {},
  },
  plugins: [],
};
