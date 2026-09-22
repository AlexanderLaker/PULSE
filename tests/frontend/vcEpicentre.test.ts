/**
 * The value-chain epicentre (lib/valueChain.ts): TypeScript twin of
 * tests/test_vc_epicentre.py. The engine and the dashboard must agree on a
 * driver's stage, so both suites pin the same table; change them together.
 */
import { describe, it, expect } from 'vitest';
import { VC_STEPS, canonicalVcProfile, epicentreOf } from '@/lib/valueChain';

const stage = (name: string) => VC_STEPS.indexOf(name as (typeof VC_STEPS)[number]) + 1;

describe('canonicalVcProfile', () => {
  it('writes 5 at the epicentre with a 3 / 1 falloff and 0 elsewhere', () => {
    expect(canonicalVcProfile(6)).toEqual({
      'Raw Materials': 0, Formulation: 0, Manufacturing: 0, Packaging: 1,
      'Supply Chain': 3, Marketing: 5, Commercial: 3, Consumer: 1,
    });
  });

  it('clips the falloff at both ends of the chain', () => {
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

describe('epicentreOf (the parity table of tests/test_vc_epicentre.py)', () => {
  it('round-trips the canonical profile of every stage', () => {
    for (let s = 1; s <= 8; s++) expect(epicentreOf(canonicalVcProfile(s))).toBe(s);
  });

  it('is null for an unscored or all-zero profile', () => {
    expect(epicentreOf(undefined)).toBeNull();
    expect(epicentreOf({})).toBeNull();
    expect(epicentreOf({ Marketing: 0, Consumer: 0 })).toBeNull();
  });

  it('picks the highest-scoring stage of any profile', () => {
    expect(epicentreOf({
      Manufacturing: 1, Packaging: 1, 'Supply Chain': 2, Marketing: 4, Commercial: 5, Consumer: 4,
    })).toBe(stage('Commercial'));
  });

  it('resolves a tie toward the exposure-weighted centroid', () => {
    // Raw Materials and Consumer tie at 3; the Commercial weight pulls the centroid downstream.
    expect(epicentreOf({ 'Raw Materials': 3, Commercial: 2, Consumer: 3 })).toBe(8);
  });

  it('resolves a flat profile to the earlier central stage', () => {
    expect(epicentreOf(Object.fromEntries(VC_STEPS.map((s) => [s, 2])))).toBe(4);
  });

  it('ignores keys outside the eight stages', () => {
    expect(epicentreOf({ supply_chain: 5, Manufacturing: 2 })).toBe(stage('Manufacturing'));
  });
});
