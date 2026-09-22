// ESLint flat config: Next.js core web vitals, plus the React Compiler checks.
import coreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...coreWebVitals,
  {
    rules: {
      // The React Compiler checks fail the lint: a setState inside an effect,
      // a flagged mutation or an impure render.
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/immutability': 'error',
      'react-hooks/purity': 'error',
      // Apostrophes in copy are intended.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'prism/**',
      'public/**',
      'data/**',
      // Tests are type-checked (tsconfig.check.json), not linted.
      'tests/**',
    ],
  },
];

export default config;
