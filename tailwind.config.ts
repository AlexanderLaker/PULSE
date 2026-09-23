/**
 * Tailwind scans the dashboard for class names. Its colours and shadows are
 * the tokens of lib/theme.ts under kebab-case names (`bg-theme-primary`,
 * `text-theme-on-surface-variant`, `shadow-primary-button`), so a class never
 * repeats a value the theme defines. The fonts come from next/font
 * (app/layout.tsx).
 */
import type { Config } from 'tailwindcss';
import { S, SHADOW } from './lib/theme';

const kebab = (tokens: Record<string, string>) =>
  Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), v]));

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: { theme: kebab(S) },
      boxShadow: kebab(SHADOW),
    },
  },
  plugins: [],
} satisfies Config;
