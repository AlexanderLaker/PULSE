/**
 * Runs before every dashboard test file (vitest.config.ts). Testing Library's
 * async helpers (waitFor, the findBy queries) give up after one second by
 * default, which a busy CI machine can exceed while the store's promise
 * chains settle. They return as soon as their condition holds, so a longer
 * limit changes only how long a failing test takes to report.
 */
import { configure } from '@testing-library/dom';

configure({ asyncUtilTimeout: 5000 });
