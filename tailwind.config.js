/**
 * Tailwind scans the dashboard for class names. The theme stays Tailwind's
 * own: the design tokens live in lib/theme.ts and the fonts come from
 * next/font (app/layout.tsx).
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
