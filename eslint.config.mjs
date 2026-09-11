// ESLint flat config — Next.js 16 (`next lint` was removed in v16).
// Base: eslint-config-next/core-web-vitals (natively flat-config since v16).
import coreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...coreWebVitals,
  {
    rules: {
      // React-Compiler diagnostics. The backlog of flagged patterns was
      // burned down on 2026-09-11 (the tree is at zero warnings), so these
      // stay at 'warn' as a ratchet: new code that reintroduces a
      // setState-in-effect or a flagged mutation shows up in `npm run lint`
      // instead of accumulating silently.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      // Cosmetic: literal apostrophes in JSX copy are intentional.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'pulse/**',        // Python engine — not JS-lint territory
      'public/**',
      'data/**',
      // Vitest specs are typechecked (tsconfig.check.json) but not lint-gated —
      // test ergonomics (any-casts in mocks etc.) would drown the signal.
      'tests/**',
      '_NOT_FOR_HANDOVER/**',   // quarantined non-product files (gitignored)
    ],
  },
];

export default config;
