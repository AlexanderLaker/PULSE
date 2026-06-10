// ESLint flat config — Next.js 16 (next lint wurde in v16 entfernt).
// Basis: eslint-config-next/core-web-vitals (flat-config-nativ ab v16).
import coreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  ...coreWebVitals,
  {
    rules: {
      // React-Compiler-Diagnostik (advisory): bestehende, funktionierende
      // Muster — Umbau wäre Verhaltensrisiko. Als Warnungen sichtbar halten,
      // Abbau gehört auf die IT-Refactoring-Liste (siehe Handover-Audit).
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      // Kosmetik: Apostrophe in JSX-Texten sind gewollt.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'pulse/**',        // Python-Engine — kein JS-Lint
      'public/**',
      'data/**',
      '_ARCHIVE/**',
      'tests/**',
    ],
  },
];
