// @vitest-environment jsdom
/**
 * VC epicentre invariants (July 2026 redesign): the stage ↔ profile mapping
 * behind the epicentre slider must round-trip for every stage, and reading an
 * arbitrary profile must pick the max-scoring stage — ties resolve toward the
 * exposure-weighted centroid. Positions are CATEGORICAL: Review & Endorse
 * counts votes per stage and must never present an average as a position
 * (a Supply Chain vote and two Commercial votes must not become "Marketing").
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/hooks/usePrism', () => ({
  __esModule: true,
  default: () => ({}),
  PrismProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/api/client', () => ({
  getTrendProposals: vi.fn(),
  saveMyProposal: vi.fn(),
  updateTrend: vi.fn(),
}));

import { epicentreOf, canonicalVcProfile } from '@/components/dashboard/Trends2';

const STEPS = [
  'Raw Materials', 'Formulation', 'Manufacturing', 'Packaging',
  'Supply Chain', 'Marketing', 'Commercial', 'Consumer',
];

describe('canonicalVcProfile', () => {
  it('writes 5 at the epicentre with a 3/1 falloff, 0 elsewhere', () => {
    expect(canonicalVcProfile(6)).toEqual({
      'Raw Materials': 0, Formulation: 0, Manufacturing: 0, Packaging: 1,
      'Supply Chain': 3, Marketing: 5, Commercial: 3, Consumer: 1,
    });
  });

  it('clips the falloff at both chain ends', () => {
    expect(canonicalVcProfile(1)).toEqual({
      'Raw Materials': 5, Formulation: 3, Manufacturing: 1, Packaging: 0,
      'Supply Chain': 0, Marketing: 0, Commercial: 0, Consumer: 0,
    });
    expect(canonicalVcProfile(8)).toEqual({
      'Raw Materials': 0, Formulation: 0, Manufacturing: 0, Packaging: 0,
      'Supply Chain': 0, Marketing: 1, Commercial: 3, Consumer: 5,
    });
  });
});

describe('epicentreOf', () => {
  it('round-trips the canonical profile for every stage (incl. clipped ends)', () => {
    for (let stage = 1; stage <= 8; stage++) {
      expect(epicentreOf(canonicalVcProfile(stage))).toBe(stage);
    }
  });

  it('returns null for unscored / all-zero profiles', () => {
    expect(epicentreOf(undefined)).toBeNull();
    expect(epicentreOf({})).toBeNull();
    expect(epicentreOf({ Marketing: 0, Consumer: 0 })).toBeNull();
  });

  it('picks the max-scoring stage of an arbitrary (legacy) profile', () => {
    expect(epicentreOf({
      Manufacturing: 1, Packaging: 1, 'Supply Chain': 2,
      Marketing: 4, Commercial: 5, Consumer: 4,
    })).toBe(STEPS.indexOf('Commercial') + 1);
  });

  it('resolves max ties toward the exposure-weighted centroid', () => {
    // Max 3 at Raw Materials and Consumer; the Commercial weight pulls the
    // centroid downstream → Consumer wins the tie.
    expect(epicentreOf({ 'Raw Materials': 3, Commercial: 2, Consumer: 3 })).toBe(8);
  });

  it('reads snake_case fallback keys from old payloads', () => {
    expect(epicentreOf({ supply_chain: 5, manufacturing: 2 })).toBe(5);
  });
});
