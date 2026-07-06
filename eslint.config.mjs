// ESLint flat config — Next.js 16 (`next lint` was removed in v16).
// Base: eslint-config-next/core-web-vitals (natively flat-config since v16).
import coreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  ...coreWebVitals,
  {
    rules: {
      // React-Compiler diagnostics (advisory): the flagged patterns are
      // existing, working code — rewriting them is behavior risk for zero
      // user value right now. Kept VISIBLE as warnings; burning them down
      // belongs on the DX refactoring backlog (see HANDOVER.md).
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
