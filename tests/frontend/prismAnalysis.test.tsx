// @vitest-environment jsdom
/**
 * The Drivers page: the PRISM Analysis card, and around it the Edited chip
 * and the admin save.
 *
 *   1. `splitAnalysis` turns a reading into its four labelled paragraphs and
 *      the basis line, and keeps a text without labels as plain prose.
 *   2. An expanded driver shows the labels as headings, the basis line and
 *      the footnote; in the admin editor the reading stays read-only text.
 *   3. The committed readings (data/drivers/driver_analysis.json) have that
 *      structure for all 51 drivers (tests/test_driver_analysis.py holds
 *      their content to the rules).
 *   4. An unedited driver carries no provenance chip; an edited one carries
 *      the Edited chip, whose tooltip lists each changed input with its
 *      baseline value.
 *   5. The admin save sends the revision it started from and only the
 *      fields that changed, never the PRISM Analysis; it shows the error when
 *      the store rejects the write and says so when the driver changed
 *      meanwhile.
 *   6. A reading whose basis median differs from the served run's says so.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import type { Driver } from '@/types';
import type { PrismStore } from '@/hooks/usePrism';
import { linearPath, makeDriver, makeSimulation, makeStore } from './fixtures/prism';

const STORE = vi.hoisted(() => ({ current: null as PrismStore | null }));

vi.mock('@/hooks/usePrism', () => ({ default: () => STORE.current }));
vi.mock('@/lib/apiClient', async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import('@/lib/apiClient')>()).ApiError,
  getDriverProposals: vi.fn(async () => { throw new Error('not used in these tests'); }),
  saveMyProposal: vi.fn(async () => { throw new Error('not used in these tests'); }),
}));

import { ApiError } from '@/lib/apiClient';
import Drivers from '@/components/dashboard/Drivers';
import { basisMedian, splitAnalysis } from '@/components/dashboard/drivers/PrismAnalysis';

// framer-motion restores the scroll position after it measures the expanded
// panel's height; jsdom has no window.scrollTo, and scrolling is not under test.
window.scrollTo = (() => {}) as typeof window.scrollTo;

const REPO = path.resolve(__dirname, '..', '..');
const ANALYSIS = JSON.parse(fs.readFileSync(
  path.join(REPO, 'data', 'drivers', 'driver_analysis.json'), 'utf8'));
const RECORD = JSON.parse(fs.readFileSync(
  path.join(REPO, 'data', 'drivers', 'driver_attribution.json'), 'utf8'));
const LABELS = ['Weight in the answer', 'Where it lands', 'When it lands', 'What the band hinges on'];
// The headline the basis line names, read from the record (never a typed number).
const HEADLINE = (RECORD.reference_run.portfolio_terminal.median * 100).toFixed(1);
const BASIS_PIN = `reconciled to a 2035 portfolio median of ${HEADLINE} percent`;
const FOOTNOTE = 'Attribution at the score means, reconciled to the portfolio median in the basis line; a reading authored on those figures.';

const READING = ANALYSIS.drivers['C-01'].text as string;
const ROW_NAME = /Private label structural penetration/;

afterEach(() => cleanup());

/** Renders the page on one driver and expands its row. */
function openDriver(overrides: Partial<Driver> = {}, options: { isAdmin?: boolean; store?: Partial<PrismStore> } = {}) {
  const driver = makeDriver({ analysis: READING, ...overrides });
  STORE.current = makeStore({ drivers: [driver], ...options.store });
  const view = render(<Drivers isAdmin={options.isAdmin ?? false} />);
  fireEvent.click(screen.getByRole('button', { name: ROW_NAME }));
  return { ...view, driver, store: STORE.current };
}

describe('splitAnalysis', () => {
  it('splits a reading into the four labelled paragraphs and the basis line', () => {
    const parts = splitAnalysis(READING);
    expect(parts.map((p) => p.label)).toEqual([...LABELS, 'Figures']);
    expect(parts[0].body.startsWith('Private label carries')).toBe(true);
    expect(parts[4].body).toMatch(/^model attribution on the estimated HCB gross-profit mix/);
    expect(parts[4].body).toContain(BASIS_PIN);
  });

  it('keeps a text without labels as one plain paragraph and a blank text as nothing', () => {
    expect(splitAnalysis('Mechanism: price/mix. Probability 5 of 5.')).toEqual([
      { label: null, body: 'Mechanism: price/mix. Probability 5 of 5.' },
    ]);
    expect(splitAnalysis('')).toEqual([]);
    expect(splitAnalysis('\n\n  \n')).toEqual([]);
  });
});

describe('Drivers page: the PRISM Analysis card', () => {
  it('shows the labelled reading in order, the basis line and the footnote once expanded', () => {
    const { container } = openDriver();
    const card = container.querySelector('[data-testid="prism-analysis"]') as HTMLElement;
    expect(card).toBeTruthy();
    const text = card.textContent ?? '';
    const positions = LABELS.map((label) => text.indexOf(label));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(text).toContain('Figures:');
    expect(text).toContain(BASIS_PIN);
    expect(container.textContent).toContain(FOOTNOTE);
  });

  it('stays read-only text in the admin editor', () => {
    const { container } = openDriver({}, { isAdmin: true });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const card = container.querySelector('[data-testid="prism-analysis"]') as HTMLElement;
    expect(card.textContent).toContain(LABELS[0]);
    expect(card.querySelector('textarea, input')).toBeNull();
    expect(container.querySelectorAll('textarea')).toHaveLength(1);   // the description
    expect(container.textContent).toContain('The figures of the PRISM Analysis come from the model and the reading is authored on them; it cannot be edited here.');
  });

  it('says so when a driver has no reading', () => {
    const { container } = openDriver({ analysis: '' });
    expect(container.querySelector('[data-testid="prism-analysis"]')).toBeNull();
    expect(container.textContent).toContain('No PRISM Analysis available for this driver.');
  });
});

describe('the committed readings', () => {
  const codes = Object.keys(ANALYSIS.drivers);

  it('cover the 51 drivers with the four labels, the basis line and a rendered text per template', () => {
    expect(codes.length).toBe(51);
    for (const code of codes) {
      const { template, text } = ANALYSIS.drivers[code];
      expect(typeof template, code).toBe('string');
      const parts = splitAnalysis(text);
      expect(parts.map((p) => p.label), code).toEqual([...LABELS, 'Figures']);
      expect(text, code).not.toMatch(/\{\w+\}/);
    }
  });
});

describe('Drivers page: the Edited chip', () => {
  const edited = (root: HTMLElement) => Array.from(root.querySelectorAll('[title^="Edited by an admin"]'));

  it('is absent on a driver no admin has changed', () => {
    const { container } = openDriver();
    expect(edited(container)).toEqual([]);
  });

  it('lists each changed input with its baseline value on an edited driver', () => {
    const base = makeDriver();
    const { container } = openDriver({
      probability: 4,
      peak_year: 2031,
      category_exposure: { ...base.category_exposure, 'LHC: FCN': 5 },
      scores_edited: true,
    });
    const chips = edited(container);
    expect(chips).toHaveLength(2);   // the row's last column and the panel's meta row
    expect(chips[0].textContent).toBe('Edited');
    expect(chips[0].getAttribute('title')!.split('\n')).toEqual([
      'Edited by an admin. Changed from the baseline:',
      'Probability: 4 / 5 (baseline 5 / 5)',
      'Peak year: 2031 (baseline 2030)',
      'Category exposure: FCN 5 (baseline 3)',
    ]);
    expect(screen.getByTitle('Baseline 5 / 5 · edited to 4 / 5')).toBeTruthy();
  });

  it('says when an edited driver has no baseline to compare with', () => {
    const { container } = openDriver({ scores_edited: true, baseline: null });
    expect(edited(container)[0].getAttribute('title'))
      .toBe('Edited by an admin. This driver has no baseline to compare with.');
  });
});

describe('Drivers page: the admin editor', () => {
  it('is for admins only, like the Review & Endorse mode', () => {
    openDriver();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Review & Endorse/ })).toBeNull();
    expect(screen.getByText(/Read-only · admin-maintained/)).toBeTruthy();
    cleanup();

    openDriver({}, { isAdmin: true });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Review & Endorse/ })).toBeTruthy();
  });

  it('saves only the fields that changed, never the PRISM Analysis', async () => {
    const { driver, store } = openDriver({}, { isAdmin: true });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue(driver.description), {
      target: { value: 'Private label keeps gaining share across European grocery.' },
    });
    fireEvent.change(screen.getByDisplayValue('Apr 2026'), { target: { value: 'May 2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(store.updateDriver).toHaveBeenCalledTimes(1));
    expect(store.updateDriver).toHaveBeenCalledWith('consumer_r01', {
      revision: 1,
      description: 'Private label keeps gaining share across European grocery.',
      sources: [{
        title: 'Circana: private label reaches a record share', url: 'https://example.org/circana', tier: 'A', note: 'May 2026',
      }],
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy());
  });

  it('closes without a request when nothing changed', async () => {
    const { store } = openDriver({}, { isAdmin: true });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy());
    expect(store.updateDriver).not.toHaveBeenCalled();
  });

  it('keeps the editor open with the error when the store rejects the save', async () => {
    const updateDriver = vi.fn<PrismStore['updateDriver']>(async () => { throw new Error('Driver consumer_r01 not found'); });
    openDriver({}, { isAdmin: true, store: { updateDriver } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const probability = screen.getByRole('radiogroup', { name: /^Probability/ });
    fireEvent.click(within(probability).getByRole('radio', { name: '3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText('Driver consumer_r01 not found')).toBeTruthy());
    expect(updateDriver).toHaveBeenCalledWith('consumer_r01', { revision: 1, probability: 3 });
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('says so when the driver changed meanwhile, and keeps the edits until they are discarded', async () => {
    const updateDriver = vi.fn<PrismStore['updateDriver']>(async () => {
      throw new ApiError(409, 'This driver was changed after you opened it.');
    });
    const { driver } = openDriver({}, { isAdmin: true, store: { updateDriver } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue(driver.description), { target: { value: 'My wording.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/changed by someone else while you were editing/)).toBeTruthy();
    expect(screen.getByDisplayValue('My wording.')).toBeTruthy();
  });
});

describe('the basis line against the served run', () => {
  it('reads the median a reading was reconciled to', () => {
    expect(basisMedian(READING)).toEqual({ year: '2035', percent: Number(HEADLINE) });
    expect(basisMedian('no basis here')).toBeNull();
  });

  it('adds a note only when the served run has moved away from it', () => {
    openDriver({}, { store: { simulation: makeSimulation({ totals: { ...makeSimulation().totals, portfolio: linearPath(-0.061) } }) } });
    expect(screen.getByRole('note').textContent).toContain('portfolio median of -6.1%');
    cleanup();
    openDriver({}, { store: { simulation: makeSimulation({ totals: { ...makeSimulation().totals, portfolio: linearPath(Number(HEADLINE) / 100) } }) } });
    expect(screen.queryByRole('note')).toBeNull();
  });
});
