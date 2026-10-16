// @vitest-environment jsdom
/**
 * The admin editor on the Drivers page, around its form:
 *
 *   - The GP1 number field keeps what is typed and clamps when it is left,
 *     so a cleared field never jumps to 1 under the admin's fingers.
 *   - A source with a tier or a date but no title or link says so and holds
 *     Save, with the reason beside the button.
 *   - The tier select shows the letters; the chosen tier's meaning follows
 *     in a line, and the whole scale sits behind the card's help.
 *   - Edit moves focus to the description; Cancel and a save move it back to
 *     the Edit button; a save says "Saved" in a status region for a moment.
 *   - The read view leads with the plain reading of the uncertainty score,
 *     the confidence chip explains itself, and the evidence line is in
 *     sentence case.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import type { Driver } from '@/types';
import type { PrismStore } from '@/hooks/usePrism';
import { makeDriver, makeStore } from './fixtures/prism';

const STORE = vi.hoisted(() => ({ current: null as PrismStore | null }));

vi.mock('@/hooks/usePrism', () => ({ default: () => STORE.current }));
vi.mock('@/lib/apiClient', async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import('@/lib/apiClient')>()).ApiError,
  getDriverProposals: vi.fn(async () => { throw new Error('not used in these tests'); }),
  saveMyProposal: vi.fn(async () => { throw new Error('not used in these tests'); }),
}));

import Drivers from '@/components/dashboard/Drivers';
import { FIELD_HELP } from '@/components/dashboard/drivers/cards';

window.scrollTo = (() => {}) as typeof window.scrollTo;

afterEach(() => cleanup());

const ROW = /Private label structural penetration/;

function openPanel(overrides: Partial<Driver> = {}, store: Partial<PrismStore> = {}) {
  const driver = makeDriver({ revision: 3, ...overrides });
  STORE.current = makeStore({ drivers: [driver], ...store });
  render(<Drivers isAdmin />);
  fireEvent.click(screen.getByRole('button', { name: ROW }));
  return driver;
}

async function openEditor(overrides: Partial<Driver> = {}, store: Partial<PrismStore> = {}) {
  const driver = openPanel(overrides, store);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  return driver;
}

const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;

describe('the GP1 number field', () => {
  it('keeps what is typed and clamps when it is left', async () => {
    const driver = await openEditor();
    const field = screen.getByRole('textbox', { name: 'GP1 % affected, in percent' }) as HTMLInputElement;
    const slider = screen.getByRole('slider', { name: 'GP1 % affected' }) as HTMLInputElement;
    expect(field.value).toBe('22');
    fireEvent.change(field, { target: { value: '' } });
    expect(field.value).toBe('');            // no jump to 1
    expect(slider.value).toBe('22');
    fireEvent.blur(field);
    expect(field.value).toBe('22');          // nothing typed: back to the draft's value
    fireEvent.change(field, { target: { value: '150' } });
    expect(field.value).toBe('150');
    fireEvent.blur(field);
    expect(field.value).toBe('100');
    expect(slider.value).toBe('100');
    fireEvent.change(field, { target: { value: '35' } });
    expect(slider.value).toBe('35');         // a whole percent in range reaches the draft as typed
    fireEvent.click(save());
    await waitFor(() => expect(STORE.current!.updateDriver).toHaveBeenCalledTimes(1));
    expect(vi.mocked(STORE.current!.updateDriver).mock.calls[0]).toEqual([driver.id, { revision: 3, gp1_pct_affected: 0.35 }]);
  });
});

describe('the sources', () => {
  it('asks for a title or a link on a source that has only a tier, and holds Save', async () => {
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
    const tiers = screen.getAllByRole('combobox', { name: 'Source tier' });
    const tier = tiers[tiers.length - 1]!;
    expect(within(tier).getAllByRole('option').map((o) => o.textContent)).toEqual(
      ['Tier', 'S', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'D', 'E']);
    fireEvent.change(tier, { target: { value: 'A' } });
    expect(screen.getByText('Needs a title or a link')).toBeTruthy();
    // The fixture's own source is tier A too, so the meaning now shows under both.
    expect(screen.getAllByText(/^A: Analyst, consulting or market-measurement research/)).toHaveLength(2);
    expect(save().disabled).toBe(true);
    expect(screen.getByText('A source needs a title or a link before the driver can be saved.')).toBeTruthy();
    expect(save().getAttribute('aria-describedby')).toBe(
      screen.getByText('A source needs a title or a link before the driver can be saved.').getAttribute('id'));
    const titles = screen.getAllByRole('textbox', { name: 'Source title' });
    fireEvent.change(titles[titles.length - 1]!, { target: { value: 'Trade note' } });
    expect(screen.queryByText('Needs a title or a link')).toBeNull();
    expect(save().disabled).toBe(false);
  });

  it('keeps the whole tier scale behind the Sources card help', async () => {
    openPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'About Sources · 1' }));
    expect(screen.getByText(/^Source tiers, strongest first\. S: Statute, regulator/)).toBeTruthy();
    expect(screen.getByText(/E: Social media or unverified\.$/)).toBeTruthy();
  });
});

describe('focus and the save status', () => {
  it('moves focus to the description on Edit and back to Edit on Cancel', async () => {
    openPanel();
    const edit = await screen.findByRole('button', { name: 'Edit' });
    fireEvent.click(edit);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Description' }));
    expect(screen.getByText('No changes yet')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), { target: { value: 'My wording.' } });
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const editAgain = await screen.findByRole('button', { name: 'Edit' });
    expect(document.activeElement).toBe(editAgain);
    expect(screen.queryByDisplayValue('My wording.')).toBeNull();
  });

  it('says Saved in a status region after a save and gives focus to Edit', async () => {
    await openEditor();
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), { target: { value: 'My wording.' } });
    fireEvent.click(save());
    const saved = await screen.findByText('Saved');
    expect(saved.closest('[role="status"]')).toBeTruthy();
    const edit = screen.getByRole('button', { name: 'Edit' });
    await waitFor(() => expect(document.activeElement).toBe(edit));
  });
});

describe('the read view', () => {
  it('leads with the plain reading of the uncertainty score and explains the confidence chip', async () => {
    openPanel({ uncertainty: 3 });
    expect(await screen.findByText('Uncertainty 3: size could be half or double, or the onset depends on an undated trigger')).toBeTruthy();
    const confidence = screen.getByText('Confidence Medium');
    expect(confidence.getAttribute('title')).toBe(FIELD_HELP.confidence);
    expect(FIELD_HELP.confidence).toBe("How well the driver's present state is evidenced: High, Medium or Low. It is not the probability of the effect.");
    // The evidence line is in sentence case and may wrap.
    const evidence = screen.getByText('Circana (Apr 2026)');
    expect(evidence.style.textTransform).toBe('none');
    expect(evidence.style.whiteSpace).toBe('normal');
    // The statistics behind the score are in the card's help, not on its face.
    fireEvent.click(screen.getByRole('button', { name: 'About Uncertainty' }));
    expect(screen.getByText(/Beta concentration 6, peak-year jitter plus or minus 2 years/)).toBeTruthy();
  });

  it('shows the expanded row with its code at the head of the panel', async () => {
    openPanel();
    expect(screen.getAllByText('C-01').length).toBe(2);   // the row and the panel head
    expect(screen.getByText('Driver code')).toBeTruthy();
  });
});
