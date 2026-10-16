// @vitest-environment jsdom
/**
 * The Consumer Journey page: the rail, the tile dialog with its Why-chain, the
 * link to the Drivers page and the stage context, the content the API serves
 * (the base content or a saved version, with the stage contexts, and nothing
 * of it before the API has answered or when it cannot be reached), and the
 * admin save with its version check.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import type { PrismStore } from '@/hooks/usePrism';
import type { JourneyContent, JourneyContexts, JourneyTile } from '@/data/consumerJourney';
import { ApiError, type StoredJourney } from '@/lib/apiClient';
import journey from '@/data/content/consumer_journey.json';
import { makeDriver, makeStore } from './fixtures/prism';

/** The base content as the API serves it: the hand-authored JSON. */
const BASE = journey as unknown as { tiles: JourneyContent; contexts: JourneyContexts };
const SERVED_BASE: StoredJourney = { version: 0, source: 'base', content: BASE.tiles, contexts: BASE.contexts };

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
import { ViewUrlProvider } from '@/hooks/useViewUrl';

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
  API.getJourneyContent.mockReset().mockResolvedValue(SERVED_BASE);
  API.saveJourneyContent.mockReset().mockResolvedValue({ status: 'saved', version: 1, tiles: 300 });
});

afterEach(() => cleanup());

/** Opens a tile once the journey has answered (the rail waits for it). */
async function openTile(name = TILE) {
  fireEvent.click(await screen.findByText(name));
  return within(screen.getByRole('dialog'));
}

/** The notice the board shows instead of its content when the API cannot be reached. */
const UNAVAILABLE = /The journey could not be loaded from the PRISM service, so there are no tiles to show; the tiles and the stage contexts appear once it answers\./;

describe('ConsumerJourney: rail and tile dialog', () => {
  it('strips trailing parentheticals from tile names in the rail', async () => {
    const { container } = render(<ConsumerJourney />);
    await screen.findByText(TILE);
    expect(container.textContent).toContain('Garment care advisory service');
    expect(container.textContent).not.toContain('(digital)');
    expect(container.textContent).not.toContain('(auto-dose)');
  });

  it('states that its tiles are strategist hypotheses, its scope, and that the Home Care journey is not built yet', () => {
    render(<ConsumerJourney />);
    expect(screen.getByText('Strategist hypotheses, not findings.')).toBeTruthy();
    expect(screen.getByText(/the tiles do not cite their sources yet, the evidence grade on each is its author’s own, and authored content does not feed the Shift Matrix\./))
      .toBeTruthy();
    expect(screen.queryByText(/click any tile for its evidence/)).toBeNull();
    expect(screen.getByText(/the Home Care \(dish \/ surface \/ Toilet Care\) journey is not built yet/)).toBeTruthy();
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

    expect(dialog.getByText('Strategist-authored · Sep 2026')).toBeTruthy();
    expect(dialog.getByText('Grade: Estimate')).toBeTruthy();
    expect(dialog.getByText('Authored analysis, not simulated')).toBeTruthy();
  });

  it('says what the three ratings mean and writes the intensity in words', async () => {
    render(<ConsumerJourney />);
    const dialog = await openTile();
    expect(dialog.getByText('Intensity: Strong (3 of 3)')).toBeTruthy();
    expect(dialog.getByText(
      'Grade: how well the tile is evidenced. Intensity: how hard it hits this moment. Impact: the authored size of the pool at stake.',
    )).toBeTruthy();
  });

  it('shows the parenthetical the pill drops as the subtitle of the dialog', async () => {
    render(<ConsumerJourney />);
    const dialog = await openTile('Garment care advisory service');
    expect(dialog.getByRole('heading', { level: 2 }).textContent).toBe('Garment care advisory service');
    expect(dialog.getByText('digital')).toBeTruthy();
  });

  it('keeps the driver\'s own direction chip and says what it means for the moment', async () => {
    render(<ConsumerJourney />);
    const dialog = await openTile();
    expect(dialog.getByText('Expansion')).toBeTruthy();
    expect(dialog.getByText('tailwind for this moment')).toBeTruthy();
    expect(dialog.getByText(/classifies this moment as/).textContent).toContain('as a tailwind.');
    expect(dialog.queryByText(/\(benefiting\)/)).toBeNull();
  });

  it('shows the keyboard hint once a key has been used', async () => {
    render(<ConsumerJourney />);
    const dialog = await openTile();
    fireEvent.keyDown(window, { key: 'Shift' });
    expect(dialog.getByText('Esc to close, left and right arrows for the next tile')).toBeTruthy();
  });

  it('explains the tint in a legend and names side and impact grade on every pill', async () => {
    render(<ConsumerJourney />);
    await screen.findByText(TILE);
    expect(screen.getByText('darker = higher authored profit-pool impact')).toBeTruthy();
    for (const grade of ['Low', 'Med', 'High']) expect(screen.getByText(grade)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Detergent sheets & pods, tailwind, high impact' })).toBeTruthy();
    expect(screen.getByRole('button', { name: `${TILE}, tailwind, medium impact` })).toBeTruthy();
  });

  it('shows an unpressed type filter at full opacity, its state in the border and aria-pressed', async () => {
    render(<ConsumerJourney />);
    await screen.findByText(TILE);
    const tech = screen.getByRole('button', { name: 'Tech' });
    expect(tech.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(tech);
    expect(tech.getAttribute('aria-pressed')).toBe('false');
    expect(tech.style.opacity).toBe('');
    expect(tech.style.border).toContain('1px solid');
    expect(screen.queryByText(TILE)).toBeNull();   // a tech tile
  });

  it('shows the authored context of the tile\'s stage, as the API served it', async () => {
    render(<ConsumerJourney />);
    const dialog = await openTile();
    expect(dialog.getByText('Stage context: Sorting')).toBeTruthy();
    expect(dialog.getByText('Henkel brands')).toBeTruthy();
    expect(dialog.getByText(BASE.contexts.lhc.sorting!.henkelBrands)).toBeTruthy();
    expect(dialog.getByText(BASE.contexts.lhc.sorting!.opportunity)).toBeTruthy();
  });

  it('shows the context the payload carries, not a copy of its own', async () => {
    API.getJourneyContent.mockResolvedValue({
      ...SERVED_BASE,
      contexts: {
        lhc: { sorting: { henkelBrands: 'Served brands', competitors: 'Served competitors', opportunity: 'Served opportunity' } },
        hair: {},
      },
    });
    render(<ConsumerJourney />);
    const dialog = await openTile();
    expect(dialog.getByText('Served brands')).toBeTruthy();
    expect(dialog.getByText('Served competitors')).toBeTruthy();
    expect(dialog.queryByText(BASE.contexts.lhc.sorting!.henkelBrands)).toBeNull();
    // a stage the payload has no context for shows no context block
    fireEvent.click(dialog.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const later = await openTile('Detergent sheets & pods');
    expect(later.queryByText(/^Stage context: /)).toBeNull();
  });

  it('keys every stage context by its stage id, one for each stage', () => {
    for (const key of ['lhc', 'hair'] as const) {
      expect(Object.keys(BASE.contexts[key]).sort()).toEqual(BASE.tiles[key].map((stage) => stage.id).sort());
    }
  });

  it('links a driver card to the Drivers page with the live driver name', async () => {
    const onNavigateToDriver = vi.fn();
    render(<ConsumerJourney onNavigateToDriver={onNavigateToDriver} />);
    fireEvent.click((await openTile()).getByText('View in Drivers'));
    expect(onNavigateToDriver).toHaveBeenCalledWith('AI and automation productivity (live row)');
  });

  it('shows the code and the force only until the drivers arrive, and counts no direction', async () => {
    STORE.current = makeStore({ drivers: [] });
    render(<ConsumerJourney />);
    const dialog = await openTile();
    expect(dialog.getByText('T-01')).toBeTruthy();
    expect(dialog.getAllByText('Technology').length).toBeGreaterThan(0);   // the force chip
    expect(dialog.getByText('The drivers have not loaded yet: the name, direction and description follow.')).toBeTruthy();
    expect(dialog.getByText('The tailwind and headwind count follows once the drivers have loaded.')).toBeTruthy();
    // neither the live name nor the driver base's name or first sentence: the bundle has no such text
    expect(dialog.queryByText(/live row/)).toBeNull();
    expect(dialog.queryByText(/in innovation, marketing and manufacturing/)).toBeNull();
    expect(dialog.queryByText(/tailwind for this moment/)).toBeNull();
    expect(dialog.queryByText(/1 tailwind/)).toBeNull();
    expect(dialog.getByText(/Dominant force/).textContent).toContain('Technology');
  });

  it('searches the Drivers page by code while the driver\'s name is not known', async () => {
    STORE.current = makeStore({ drivers: [] });
    const onNavigateToDriver = vi.fn();
    render(<ConsumerJourney onNavigateToDriver={onNavigateToDriver} />);
    fireEvent.click((await openTile()).getByText('View in Drivers'));
    expect(onNavigateToDriver).toHaveBeenCalledWith('T-01');
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

describe('ConsumerJourney: the served content and the admin save', () => {
  /** A saved version as the API serves it: one tile, with the base contexts. */
  const STORED_TILE: JourneyTile = {
    id: 'lhc.sorting.exp.stored',
    name: 'Stored tile',
    type: 'tech',
    driverCodes: ['T-01'],
    driverNote: 'T-01 AI and automation productivity',
    intensity: 2,
    provenance: { date: '2026-10', grade: 'verified' },
    analysis: null,
  };
  const SERVED_STORED: StoredJourney = {
    version: 7,
    source: 'stored',
    content: { lhc: [{ id: 'sorting', label: 'Sorting', benefiting: [STORED_TILE], negativelyImpacted: [] }], hair: [] },
    contexts: BASE.contexts,
  };

  it('shows the tiles the API serves: the base content, or the saved version', async () => {
    const { unmount } = render(<ConsumerJourney />);
    expect(await screen.findByText(TILE)).toBeTruthy();
    expect(screen.queryByText('Stored tile')).toBeNull();
    unmount();

    API.getJourneyContent.mockResolvedValue(SERVED_STORED);
    render(<ConsumerJourney />);
    expect(await screen.findByText('Stored tile')).toBeTruthy();
    expect(screen.queryByText(TILE)).toBeNull();
    // the stage context still comes with the payload
    const dialog = await openTile('Stored tile');
    expect(dialog.getByText(BASE.contexts.lhc.sorting!.henkelBrands)).toBeTruthy();
  });

  it('keeps the editing controls from a viewer', () => {
    render(<ConsumerJourney />);
    expect(screen.queryByRole('button', { name: 'Edit board' })).toBeNull();
  });

  /** The editing controls, once the journey has answered. */
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
    expect(baseVersion).toBe(0);   // the base content
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

  it('shows the notice and no tiles when the journey cannot be loaded again after a refused save', async () => {
    API.getJourneyContent
      .mockResolvedValueOnce(SERVED_STORED)
      .mockRejectedValueOnce(new ApiError(500, 'database down'));
    API.saveJourneyContent.mockRejectedValue(new ApiError(409, 'saved by someone else'));
    render(<ConsumerJourney isAdmin />);
    expect(await screen.findByText('Stored tile')).toBeTruthy();
    await startEditing();
    fireEvent.click(screen.getByRole('button', { name: 'Save for everyone' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Load the saved version' }));
    expect(await screen.findByText(UNAVAILABLE)).toBeTruthy();
    expect(screen.queryByText('Stored tile')).toBeNull();
    expect(screen.queryByText(TILE)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save for everyone' })).toBeNull();
  });

  it('with the API down, shows an admin the notice and nothing of the board, editing controls included', async () => {
    API.getJourneyContent.mockRejectedValue(new ApiError(500, 'database down'));
    render(<ConsumerJourney isAdmin />);
    expect(await screen.findByText(UNAVAILABLE)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit board' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save for everyone' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Laundry' })).toBeNull();
    expect(screen.queryByText(TILE)).toBeNull();
    expect(screen.queryByText(/Stage \d/)).toBeNull();
    // the page still says what the view is
    expect(screen.getByText('Where Profit Pools Shift Along the Journey')).toBeTruthy();
    expect(screen.getByText('Strategist hypotheses, not findings.')).toBeTruthy();
  });

  it('shows nothing of the content while the journey loads', async () => {
    let answer: (served: StoredJourney) => void = () => {};
    API.getJourneyContent.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    render(<ConsumerJourney />);
    expect(screen.getByRole('status').textContent).toBe('Loading the journey…');
    expect(screen.queryByText(TILE)).toBeNull();
    expect(screen.queryByText(/Stage \d/)).toBeNull();
    answer(SERVED_BASE);
    expect(await screen.findByText(TILE)).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('with the API down, shows a viewer the notice and no tiles, and loads the journey again on request', async () => {
    API.getJourneyContent.mockRejectedValueOnce(new ApiError(500, 'database down'));
    render(<ConsumerJourney />);
    expect(await screen.findByText(UNAVAILABLE)).toBeTruthy();
    expect(screen.queryByText(TILE)).toBeNull();
    expect(screen.queryAllByRole('button').map((b) => b.textContent)).toEqual(['Try again']);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(API.getJourneyContent).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(TILE)).toBeTruthy();
    expect(screen.queryByText(UNAVAILABLE)).toBeNull();
  });

  it('with the API up, shows the served tiles of both journeys and their stage contexts', async () => {
    render(
      <ViewUrlProvider initial={{ view: 'consumer-journey', params: { journey: 'hair' } }}>
        <ConsumerJourney />
      </ViewUrlProvider>,
    );
    const hairTile = BASE.tiles.hair[0]!.benefiting[0]!;
    const dialog = await openTile(hairTile.name.replace(/\s*\([^()]*\)\s*$/, ''));
    expect(dialog.getByText(BASE.contexts.hair[BASE.tiles.hair[0]!.id]!.henkelBrands)).toBeTruthy();
  });
});

describe('ConsumerJourney: the draft guard of the tile editor', () => {
  /** Opens the first Sorting tile in the editor with the name changed. */
  async function editTile() {
    render(<ConsumerJourney isAdmin />);
    const edit = screen.getByRole('button', { name: 'Edit board' });
    await waitFor(() => expect((edit as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(edit);
    const dialog = await openTile();
    fireEvent.click(dialog.getByRole('button', { name: 'Edit tile' }));
    const name = dialog.getByLabelText('Tile name') as HTMLInputElement;
    fireEvent.change(name, { target: { value: `${name.value} (edited)` } });
    return { dialog, name };
  }

  it('asks before Escape drops a draft that differs, and Keep editing keeps the dialog', async () => {
    const { dialog } = await editTile();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dialog.getByText('Discard the edits to this tile?')).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText('Discard the edits to this tile?')).toBeNull();
    expect((within(screen.getByRole('dialog')).getByLabelText('Tile name') as HTMLInputElement).value).toContain('(edited)');
  });

  it('Discard closes the dialog and leaves the tile as it was', async () => {
    const { dialog } = await editTile();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(dialog.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText(TILE)).toBeTruthy();
    expect(screen.queryByText(`${TILE} (edited)`)).toBeNull();
  });

  it('closes on Escape without asking while the draft equals the tile', async () => {
    render(<ConsumerJourney isAdmin />);
    const edit = screen.getByRole('button', { name: 'Edit board' });
    await waitFor(() => expect((edit as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(edit);
    const dialog = await openTile();
    fireEvent.click(dialog.getByRole('button', { name: 'Edit tile' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('asks before a tile leaves the draft', async () => {
    const { dialog } = await editTile();
    fireEvent.click(dialog.getByRole('button', { name: 'Remove this tile' }));
    expect(dialog.getByText('Remove this tile from the draft? It is gone for everyone once you save.')).toBeTruthy();
    const pill = { name: `${TILE}, tailwind, medium impact` };
    expect(screen.getByRole('button', pill)).toBeTruthy();   // still on the board while it asks
    fireEvent.click(dialog.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', pill)).toBeNull();
  });

  it('blocks Apply on an emptied name and says why; an emptied read is allowed', async () => {
    const { dialog, name } = await editTile();
    fireEvent.change(name, { target: { value: '   ' } });
    expect(dialog.getByText('A tile needs a name')).toBeTruthy();
    expect((dialog.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(name, { target: { value: 'Renamed tile' } });
    fireEvent.change(dialog.getByLabelText('Strategist Read (authored analysis)'), { target: { value: '' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('button', { name: 'Renamed tile, tailwind, medium impact' })).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 300));   // past any exit animation: the dialog stays
    expect(within(screen.getByRole('dialog')).getByRole('heading', { level: 2 }).textContent).toBe('Renamed tile');
    expect(within(screen.getByRole('dialog')).getByText('No authored analysis for this tile yet.')).toBeTruthy();
  });
});

describe('ConsumerJourney: the address', () => {
  const AI_TILE_ID = 'lhc.sorting.exp.ai-stain-fabric-recognition-apps';
  beforeEach(() => { window.history.replaceState(null, '', '/dashboard'); });

  it('opens the journey the address names', async () => {
    render(
      <ViewUrlProvider initial={{ view: 'consumer-journey', params: { journey: 'hair' } }}>
        <ConsumerJourney />
      </ViewUrlProvider>,
    );
    expect(await screen.findByText('Shade finders & AR try-on tools')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hair' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText(TILE)).toBeNull();
  });

  it('opens the tile the address names once the journey has arrived', async () => {
    render(
      <ViewUrlProvider initial={{ view: 'consumer-journey', params: { journey: 'lhc', tile: AI_TILE_ID } }}>
        <ConsumerJourney />
      </ViewUrlProvider>,
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe(TILE);
  });

  it('keeps the tile the address names for a load that succeeds after one that failed', async () => {
    API.getJourneyContent.mockRejectedValueOnce(new ApiError(500, 'database down'));
    render(
      <ViewUrlProvider initial={{ view: 'consumer-journey', params: { journey: 'lhc', tile: AI_TILE_ID } }}>
        <ConsumerJourney />
      </ViewUrlProvider>,
    );
    expect(await screen.findByText(UNAVAILABLE)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe(TILE);
  });

  it('writes the journey and the open tile to the address, and adopts the address when it changes', async () => {
    render(
      <ViewUrlProvider initial={{ view: 'consumer-journey', params: {} }}>
        <ConsumerJourney />
      </ViewUrlProvider>,
    );
    await openTile();
    expect(window.location.search).toContain(`tile=${encodeURIComponent(AI_TILE_ID)}`);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.location.search).not.toContain('tile=');
    fireEvent.click(screen.getByRole('button', { name: 'Hair' }));
    expect(window.location.search).toContain('journey=hair');
    // Back: the address is the truth again.
    window.history.replaceState(null, '', `/dashboard?view=journey&journey=lhc&tile=${AI_TILE_ID}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe(TILE);
    window.history.replaceState(null, '', '/dashboard?view=journey&journey=lhc');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
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
