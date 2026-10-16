/**
 * The address bar as the dashboard's state (lib/viewUrl.ts): an address names
 * a view and its parameters, a state formats back to the same address, and a
 * value the taxonomy does not know is dropped rather than carried.
 */
import { describe, it, expect } from 'vitest';
import { formatViewUrl, parseViewUrl, sameViewUrl } from '@/lib/viewUrl';

describe('parseViewUrl', () => {
  it('reads the gate from no address, and from an unknown view', () => {
    expect(parseViewUrl('')).toEqual({ view: 'home', params: {} });
    expect(parseViewUrl(null)).toEqual({ view: 'home', params: {} });
    expect(parseViewUrl('?view=nothing&lens=force')).toEqual({ view: 'home', params: {} });
  });

  it('reads a lens, a year, a filter and a drill-down of the Shift Analysis', () => {
    expect(parseViewUrl('?view=shift&lens=force&year=2031&filter=contraction&category=LHC%3A+FCN')).toEqual({
      view: 'shift-analysis',
      params: { lens: 'force', year: '2031', filter: 'contraction', category: 'LHC: FCN' },
    });
  });

  it('drops a value the taxonomy does not know and keeps the rest', () => {
    expect(parseViewUrl('?view=shift&lens=magic&year=2099&category=LHC%3A+FCN')).toEqual({
      view: 'shift-analysis', params: { category: 'LHC: FCN' },
    });
    expect(parseViewUrl('?view=drivers&mode=owner&driver=abc')).toEqual({
      view: 'drivers', params: { driver: 'abc' },
    });
  });

  it('ignores a parameter of another view', () => {
    expect(parseViewUrl('?view=journey&lens=force&journey=hair')).toEqual({
      view: 'consumer-journey', params: { journey: 'hair' },
    });
  });

  it('takes the server\'s searchParams shape, first value of a repeated key', () => {
    expect(parseViewUrl({ view: ['explorer', 'shift'], group: 'Hair', kind: 'Categories' })).toEqual({
      view: 'profit-pool-explorer', params: { group: 'Hair', kind: 'Categories' },
    });
  });

  it('refuses an overlong free value', () => {
    expect(parseViewUrl(`?view=drivers&q=${'x'.repeat(201)}`)).toEqual({ view: 'drivers', params: {} });
  });
});

describe('formatViewUrl', () => {
  it('writes the gate as the bare address and a view with its parameters in a fixed order', () => {
    expect(formatViewUrl({ view: 'home', params: {} })).toBe('');
    expect(formatViewUrl({ view: 'shift-analysis', params: { category: 'LHC: FCN', lens: 'vc', year: '2030' } }))
      .toBe('?view=shift&lens=vc&year=2030&category=LHC%3A+FCN');
  });

  it('round-trips every view', () => {
    for (const address of [
      '?view=shift&lens=region&year=2028&filter=expansion&category=Hair%3A+Care',
      '?view=drivers&driver=d1&mode=review&q=private+label&category=LHC%3A+LAD',
      '?view=journey&journey=lhc&tile=t-12',
      '?view=explorer&group=LHC&kind=ValueChain&pool=enzymes',
    ]) {
      expect(formatViewUrl(parseViewUrl(address))).toBe(address);
    }
  });

  it('compares two states by their address', () => {
    expect(sameViewUrl(parseViewUrl('?view=shift&year=2031&lens=time'), { view: 'shift-analysis', params: { lens: 'time', year: '2031' } })).toBe(true);
    expect(sameViewUrl(parseViewUrl('?view=shift'), parseViewUrl('?view=drivers'))).toBe(false);
  });
});
