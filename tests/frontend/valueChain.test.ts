/**
 * The value chain on the Drivers page: a driver's stage is a name, placed on
 * the rail by its position in the chain.
 */
import { describe, it, expect } from 'vitest';
import { VC_STEPS, shortStage, stageIndex } from '@/lib/valueChain';
import { vcPos, vcStageLabel } from '@/components/dashboard/drivers/shared';

describe('the value chain', () => {
  it('places each stage by its position, and nothing else', () => {
    expect(VC_STEPS.map(stageIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const other of [null, undefined, '', 'Retail', 'marketing']) expect(stageIndex(other)).toBe(-1);
  });

  it('names a stage with its part of the chain', () => {
    expect(vcStageLabel('Packaging')).toBe('Packaging · upstream');
    expect(vcStageLabel('Supply Chain')).toBe('Supply Chain · mid-chain');
    expect(vcStageLabel('Marketing')).toBe('Marketing · downstream');
    expect(vcStageLabel(null)).toBe('unscored');
  });

  it('puts a pin at the centre of its eighth of the rail', () => {
    expect(vcPos('Raw Materials')).toBe('6.25%');
    expect(vcPos('Consumer')).toBe('93.75%');
  });

  it('shortens a stage for tight places', () => {
    expect(shortStage('Commercial')).toBe('Comm');
    expect(shortStage('Retail')).toBe('Retail');
  });
});
