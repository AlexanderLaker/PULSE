// @vitest-environment jsdom
/**
 * The Consumer Journey page: the rail, the tile dialog with its Why-chain, the
 * link to the Drivers page and the stage context, the stored content that
 * replaces the bundled tiles, and the admin save with its version check.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import type { PrismStore } from '@/hooks/usePrism';
import { HAIR_CTX, HAIR_JOURNEY, LHC_CTX, LHC_JOURNEY, type JourneyContent, type JourneyTile } from '@/data/consumerJourney';
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

/** Opens a tile once the saved journey has answered (the rail waits for it). */
async function openTile(name = TILE) {
  fireEvent.click(await screen.findByText(name));
  return within(screen.getByRole('dialog'));
}

describe('ConsumerJourney: rail and tile dialog', () => {
  it('strips trailing parentheticals from tile names in the rail', async () => {
    const { container } = render(<ConsumerJourney />);
    await screen.findByText(TILE);
    expect(container.textContent).toContain('Garment care advisory service');
    expect(container.textContent).not.toContain('(digital)');
    expect(container.textContent).not.toContain('(auto-dose)');
  });

  it('states its scope and that the Home Care journey is not built yet', () => {
    render(<ConsumerJourney />);
    expect(screen.getByText(/Authored content does not feed the Shift Matrix\./)).toBeTruthy();
    expect(screen.getByText(/the Home Care \(dish \/ surface \/ WC\) journey is not built yet/)).toBeTruthy();
  });

  it('opens a dialog with the Why-chain, the provenance and the live driver', async () => {
    render(<ConsumerJourney />);
    const dialog = await openTile();

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

  it('shows the authored context of the tile\'s stage', async () => {
    render(<ConsumerJourney />);
    const dialog = await openTile();
    expect(dialog.getByText(/^Stage context: /)).toBeTruthy();
    expect(dialog.getByText('Henkel brands')).toBeTruthy();
  });

  it('keys every stage context by its stage id, one for each stage', () => {
    for (const [journey, contexts] of [[LHC_JOURNEY, LHC_CTX], [HAIR_JOURNEY, HAIR_CTX]] as const) {
      expect(Object.keys(contexts).sort()).toEqual(journey.map((stage) => stage.id).sort());
    }
  });

  it('links a driver card to the Drivers page with the live driver name', async () => {
    const onNavigateToDriver = vi.fn();
    render(<ConsumerJourney onNavigateToDriver={onNavigateToDriver} />);
    fireEvent.click((await openTile()).getByText('View in Drivers'));
    expect(onNavigateToDriver).toHaveBeenCalledWith('AI and automation productivity (live row)');
  });

  it('shows the code map entry until the drivers arrive', async () => {
    STORE.current = makeStore({ drivers: [] });
    render(<ConsumerJourney />);
    const dialog = await openTile();
    expect(dialog.getByText(DRIVER_CODE_MAP['T-01'].name)).toBeTruthy();
    expect(dialog.getByText(/\(the drivers have not loaded yet\)/)).toBeTruthy();
  });

  it('closes on Escape', async () => {
    render(<ConsumerJourney />);
    await openTile();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('steps to the next tile with the arrow keys, but not while the caret is in a field', async () => {
    render(<ConsumerJourney />);
    const first = (await openTile()).getByRole('heading', { level: 2 }).textContent;
    const field = document.createElement('input');
    screen.getByRole('dialog').appendChild(field);
    fireEvent.keyDown(field, { key: 'ArrowRight' });
    expect(within(screen.getByRole('dialog')).getByRole('heading', { level: 2 }).textContent).toBe(first);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getByRole('heading', { level: 2 }).textContent).not.toBe(first));
  });

  it('leaves the arrow keys alone while its pane is hidden', async () => {
    const { rerender } = render(<PaneActiveContext.Provider value><ConsumerJourney /></PaneActiveContext.Provider>);
    const first = (await openTile()).getByRole('heading', { level: 2 }).textContent;
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
    fireEvent.click(screen.getByRole('button', { name: 'Save for everyone' }));
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(API.saveJourneyContent).toHaveBeenCalledTimes(1);
    const [sent, baseVersion] = API.saveJourneyContent.mock.calls[0]! as [JourneyContent, number];
    expect(Object.keys(sent).sort()).toEqual(['hair', 'lhc']);
    expect(sent.lhc.length).toBeGreaterThan(0);
    expect(sent.hair.length).toBeGreaterThan(0);
    expect(baseVersion).toBe(0);   // the bundled content
    // the next save starts from the version this one created
    fireEvent.click(screen.getByRole('button', { name: 'Save for everyone' }));
    await waitFor(() => expect(API.saveJourneyContent).toHaveBeenCalledTimes(2));
    expect(API.saveJourneyContent.mock.calls[1]![1]).toBe(1);
  });

  it('says so when the save route refuses the account', async () => {
    API.saveJourneyContent.mockRejectedValue(new ApiError(403, 'Admin role required'));
    render(<ConsumerJourney isAdmin />);
    await startEditing();
    fireEvent.click(screen.getByRole('button', { name: 'Save for everyone' }));
    expect(await screen.findByText('Admin required: your account cannot save journey content.')).toBeTruthy();
  });

  it('refuses to overwrite a save made in the meantime and offers the saved version', async () => {
    API.saveJourneyContent.mockRejectedValue(new ApiError(409, 'saved by someone else'));
    render(<ConsumerJourney isAdmin />);
    await startEditing();
    fireEvent.click(screen.getByRole('button', { name: 'Save for everyone' }));
    expect(await screen.findByText(/Someone else saved the journey after you opened it/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load the saved version' }));
    await waitFor(() => expect(API.getJourneyContent).toHaveBeenCalledTimes(2));
  });

  it('after a save that timed out, asks for the saved version before another save', async () => {
    API.saveJourneyContent.mockRejectedValue(new ApiError(0, 'The request timed out after 20 s', true));
    render(<ConsumerJourney isAdmin />);
    await startEditing();
    fireEvent.click(screen.getByRole('button', { name: 'Save for everyone' }));
    expect(await screen.findByText(/got no answer and may still have been stored/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save for everyone' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Load the saved version' }));
    await waitFor(() => expect(API.getJourneyContent).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Save for everyone' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('keeps asking for the saved version when a tile is edited after a save that timed out', async () => {
    API.saveJourneyContent.mockRejectedValue(new ApiError(0, 'The request timed out after 20 s', true));
    render(<ConsumerJourney isAdmin />);
    await startEditing();
    fireEvent.click(screen.getByRole('button', { name: 'Save for everyone' }));
    expect(await screen.findByText(/got no answer and may still have been stored/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /^Add a tailwind tile to / })[0]!);
    expect(screen.getByText(/got no answer and may still have been stored/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save for everyone' }) as HTMLButtonElement).disabled).toBe(true);
    expect(API.saveJourneyContent).toHaveBeenCalledTimes(1);
  });

  it('reports a save that landed under later edits, and saves those from the new version', async () => {
    let land: (saved: { status: string; version: number; tiles: number }) => void = () => {};
    API.saveJourneyContent.mockReturnValueOnce(new Promise((resolve) => { land = resolve; }));
    render(<ConsumerJourney isAdmin />);
    await startEditing();
    fireEvent.click(screen.getByRole('button', { name: 'Save for everyone' }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Add a tailwind tile to / })[0]!);   // while it saves
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true);
    land({ status: 'saved', version: 4, tiles: 300 });
    expect(await screen.findByText(/Saved, except the edits made while it was saving/)).toBeTruthy();
    expect(screen.queryByText('Saved')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save for everyone' }));
    await waitFor(() => expect(API.saveJourneyContent).toHaveBeenCalledTimes(2));
    expect(API.saveJourneyContent.mock.calls[1]![1]).toBe(4);
  });

  it('shows the shipped texts when the saved version cannot be loaded after a refused save', async () => {
    const tile: JourneyTile = {
      id: 'lhc.sorting.exp.stored', name: 'Stored tile', type: 'tech', driverCodes: [], driverNote: '',
      intensity: 2, provenance: { date: '2026-10', grade: 'verified' }, analysis: null,
    };
    API.getJourneyContent
      .mockResolvedValueOnce({ version: 7, content: { lhc: [{ id: 'sorting', label: 'Sorting', benefiting: [tile],
        negativelyImpacted: [] }], hair: [] } })
      .mockRejectedValueOnce(new ApiError(500, 'database down'));
    API.saveJourneyContent.mockRejectedValue(new ApiError(409, 'saved by someone else'));
    render(<ConsumerJourney isAdmin />);
    expect(await screen.findByText('Stored tile')).toBeTruthy();
    await startEditing();
    fireEvent.click(screen.getByRole('button', { name: 'Save for everyone' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Load the saved version' }));
    expect(await screen.findByText(/these are the texts shipped with PRISM/)).toBeTruthy();
    expect(screen.queryByText('Stored tile')).toBeNull();
    expect(screen.getByText(TILE)).toBeTruthy();
  });

  it('turns saving off while the saved journey cannot be loaded', async () => {
    API.getJourneyContent.mockRejectedValue(new ApiError(500, 'database down'));
    render(<ConsumerJourney isAdmin />);
    await startEditing();
    expect(await screen.findByText(/saving is off so it cannot be overwritten/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save for everyone' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBeGreaterThan(0);
  });

  it('shows nothing from the bundled copy while the saved journey loads', async () => {
    let answer: (stored: { version: number; content: null }) => void = () => {};
    API.getJourneyContent.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    render(<ConsumerJourney />);
    expect(screen.getByRole('status').textContent).toBe('Loading the saved journey…');
    expect(screen.queryByText(TILE)).toBeNull();
    answer({ version: 0, content: null });
    expect(await screen.findByText(TILE)).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('tells a viewer when the saved journey could not be loaded, and loads it again on request', async () => {
    API.getJourneyContent.mockRejectedValueOnce(new ApiError(500, 'database down'));
    render(<ConsumerJourney />);
    expect(await screen.findByText(/these are the texts shipped with PRISM; an admin may have changed them/))
      .toBeTruthy();
    expect(screen.getByText(TILE)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(API.getJourneyContent).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(/texts shipped with PRISM/)).toBeNull());
  });
});

describe('a Strategist Read', () => {
  it('separates its paragraphs with blank lines', async () => {
    const { MarkdownBlock } = await import('@/components/dashboard/journey/tiles');
    const { container } = render(<MarkdownBlock text={'**One.** First.\n\n**Two.** Second.'} />);
    expect(container.querySelectorAll('p')).toHaveLength(2);
    expect(container.querySelectorAll('strong')).toHaveLength(2);
  });
});
