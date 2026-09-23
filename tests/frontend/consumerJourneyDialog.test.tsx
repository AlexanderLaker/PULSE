// @vitest-environment jsdom
/**
 * The Consumer Journey page: the rail, the tile dialog with its Why-chain and
 * the link to the Drivers page, the stored content that replaces the bundled
 * tiles, and the admin save with its version check.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import type { PrismStore } from '@/hooks/usePrism';
import type { JourneyContent, JourneyTile } from '@/data/consumerJourney';
import { ApiError } from '@/lib/apiClient';
import { DRIVER_CODE_MAP } from '@/data/driverCodeMap';
import { makeDriver, makeStore } from './fixtures/prism';

const STORE = vi.hoisted(() => ({ current: null as PrismStore | null }));
const API = vi.hoisted(() => ({
  getJourneyContent: vi.fn(),
  saveJourneyContent: vi.fn(),
}));

vi.mock('@/hooks/usePrism', () => ({ default: () => STORE.current }));
vi.mock('@/lib/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/apiClient')>()),
  getJourneyContent: API.getJourneyContent,
  saveJourneyContent: API.saveJourneyContent,
}));

import ConsumerJourney from '@/components/dashboard/ConsumerJourney';
import { PaneActiveContext } from '@/hooks/useOverlay';

// The first Sorting tailwind tile cites T-01 (technology_r01).
const TILE = 'AI stain/fabric recognition apps';
const T01 = makeDriver({
  id: 'technology_r01',
  force: 'Technology',
  name: 'AI and automation productivity (live row)',
  direction: 'Expansion',
  description: 'AI reads the garment and prescribes the SKU.',
});

beforeEach(() => {
  STORE.current = makeStore({ drivers: [T01] });
  API.getJourneyContent.mockReset().mockResolvedValue({ version: 0, content: null });
  API.saveJourneyContent.mockReset().mockResolvedValue({ status: 'saved', version: 1, tiles: 300 });
});

afterEach(() => cleanup());

function openTile(name = TILE) {
  fireEvent.click(screen.getByText(name));
  return within(screen.getByRole('dialog'));
}

describe('ConsumerJourney: rail and tile dialog', () => {
  it('strips trailing parentheticals from tile names in the rail', () => {
    const { container } = render(<ConsumerJourney />);
    expect(container.textContent).toContain('Garment care advisory service');
    expect(container.textContent).not.toContain('(digital)');
    expect(container.textContent).not.toContain('(auto-dose)');
  });

  it('states its scope and that the Home Care journey is not built yet', () => {
    render(<ConsumerJourney />);
    expect(screen.getByText(/Authored content does not feed the Shift Matrix\./)).toBeTruthy();
    expect(screen.getByText(/the Home Care \(dish \/ surface \/ WC\) journey is not built yet/)).toBeTruthy();
  });

  it('opens a dialog with the Why-chain, the provenance and the live driver', () => {
    render(<ConsumerJourney />);
    const dialog = openTile();

    expect(dialog.getByText('Why this moment is expanding')).toBeTruthy();
    expect(dialog.getByText('Drivers behind this moment')).toBeTruthy();
    expect(dialog.getByText('Net effect')).toBeTruthy();
    expect(dialog.getByText('AI and automation productivity (live row)')).toBeTruthy();
    expect(dialog.getByText('AI reads the garment and prescribes the SKU.')).toBeTruthy();
    expect(dialog.getAllByText(/Tailwind/).length).toBeGreaterThan(0);

    expect(dialog.getByText('Strategist-authored · 2026-09')).toBeTruthy();
    expect(dialog.getByText('Estimate')).toBeTruthy();
    expect(dialog.getByText('Authored analysis, not simulated')).toBeTruthy();
  });

  it('links a driver card to the Drivers page with the live driver name', () => {
    const onNavigateToDriver = vi.fn();
    render(<ConsumerJourney onNavigateToDriver={onNavigateToDriver} />);
    fireEvent.click(openTile().getByText('View in Drivers'));
    expect(onNavigateToDriver).toHaveBeenCalledWith('AI and automation productivity (live row)');
  });

  it('shows the code map entry until the drivers arrive', () => {
    STORE.current = makeStore({ drivers: [] });
    render(<ConsumerJourney />);
    const dialog = openTile();
    expect(dialog.getByText(DRIVER_CODE_MAP['T-01'].name)).toBeTruthy();
    expect(dialog.getByText(/\(offline fallback\)/)).toBeTruthy();
  });

  it('closes on Escape', async () => {
    render(<ConsumerJourney />);
    openTile();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('steps to the next tile with the arrow keys, but not while the caret is in a field', async () => {
    render(<ConsumerJourney />);
    const first = openTile().getByRole('heading', { level: 2 }).textContent;
    const field = document.createElement('input');
    screen.getByRole('dialog').appendChild(field);
    fireEvent.keyDown(field, { key: 'ArrowRight' });
    expect(within(screen.getByRole('dialog')).getByRole('heading', { level: 2 }).textContent).toBe(first);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getByRole('heading', { level: 2 }).textContent).not.toBe(first));
  });

  it('leaves the arrow keys alone while its pane is hidden', () => {
    const { rerender } = render(<PaneActiveContext.Provider value><ConsumerJourney /></PaneActiveContext.Provider>);
    const first = openTile().getByRole('heading', { level: 2 }).textContent;
    rerender(<PaneActiveContext.Provider value={false}><ConsumerJourney /></PaneActiveContext.Provider>);
    fireEvent.keyDown(window, { key: 'ArrowRight' });   // meant for the view on screen
    expect(within(screen.getByRole('dialog')).getByRole('heading', { level: 2 }).textContent).toBe(first);
  });
});

describe('ConsumerJourney: stored content and the admin save', () => {
  it('replaces the bundled tiles with the stored content', async () => {
    const tile: JourneyTile = {
      id: 'lhc.sorting.exp.stored',
      name: 'Stored tile',
      type: 'tech',
      driverCodes: ['T-01'],
      driverNote: 'T-01 AI and automation productivity',
      intensity: 2,
      provenance: { date: '2026-10', grade: 'verified' },
      analysis: null,
    };
    const stored: JourneyContent = {
      lhc: [{ id: 'sorting', label: 'Sorting', benefiting: [tile], negativelyImpacted: [] }],
      hair: [],
    };
    API.getJourneyContent.mockResolvedValue({ version: 7, content: stored });
    render(<ConsumerJourney />);
    expect(await screen.findByText('Stored tile')).toBeTruthy();
    expect(screen.queryByText(TILE)).toBeNull();
  });

  it('keeps the editing controls from a viewer', () => {
    render(<ConsumerJourney />);
    expect(screen.queryByRole('button', { name: 'Edit board' })).toBeNull();
  });

  /** The editing controls, once the stored content has answered. */
  async function startEditing() {
    const edit = screen.getByRole('button', { name: 'Edit board' });
    await waitFor(() => expect((edit as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(edit);
  }

  it('saves the whole tile map for an admin, naming the version it was edited from', async () => {
    render(<ConsumerJourney isAdmin />);
    await startEditing();
    fireEvent.click(screen.getByRole('button', { name: 'Save to server' }));
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(API.saveJourneyContent).toHaveBeenCalledTimes(1);
    const [sent, baseVersion] = API.saveJourneyContent.mock.calls[0]! as [JourneyContent, number];
    expect(Object.keys(sent).sort()).toEqual(['hair', 'lhc']);
    expect(sent.lhc.length).toBeGreaterThan(0);
    expect(sent.hair.length).toBeGreaterThan(0);
    expect(baseVersion).toBe(0);   // the bundled content
    // the next save starts from the version this one created
    fireEvent.click(screen.getByRole('button', { name: 'Save to server' }));
    await waitFor(() => expect(API.saveJourneyContent).toHaveBeenCalledTimes(2));
    expect(API.saveJourneyContent.mock.calls[1]![1]).toBe(1);
  });

  it('says so when the save route refuses the account', async () => {
    API.saveJourneyContent.mockRejectedValue(new ApiError(403, 'Admin role required'));
    render(<ConsumerJourney isAdmin />);
    await startEditing();
    fireEvent.click(screen.getByRole('button', { name: 'Save to server' }));
    expect(await screen.findByText('Admin required: your account cannot save journey content.')).toBeTruthy();
  });

  it('refuses to overwrite a save made in the meantime and offers the saved version', async () => {
    API.saveJourneyContent.mockRejectedValue(new ApiError(409, 'saved by someone else'));
    render(<ConsumerJourney isAdmin />);
    await startEditing();
    fireEvent.click(screen.getByRole('button', { name: 'Save to server' }));
    expect(await screen.findByText(/Someone else saved the journey after you opened it/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load the saved version' }));
    await waitFor(() => expect(API.getJourneyContent).toHaveBeenCalledTimes(2));
  });

  it('turns saving off while the saved journey cannot be loaded', async () => {
    API.getJourneyContent.mockRejectedValue(new ApiError(500, 'database down'));
    render(<ConsumerJourney isAdmin />);
    await startEditing();
    expect(await screen.findByText(/saving is off so it cannot be overwritten/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save to server' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('a Strategist Read', () => {
  it('separates its paragraphs with blank lines, whether written out or escaped', async () => {
    const { MarkdownBlock } = await import('@/components/dashboard/journey/tiles');
    const { unescapeBreaks } = await import('@/components/dashboard/journey/shared');
    for (const text of ['**One.** First.\n\n**Two.** Second.', '**One.** First.\\n\\n**Two.** Second.']) {
      const { container, unmount } = render(<MarkdownBlock text={text} />);
      expect(container.querySelectorAll('p')).toHaveLength(2);
      expect(container.querySelectorAll('strong')).toHaveLength(2);
      unmount();
    }
    expect(unescapeBreaks('A.\\n\\nB.')).toBe('A.\n\nB.');
  });
});
