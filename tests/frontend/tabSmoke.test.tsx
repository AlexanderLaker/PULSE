// @vitest-environment jsdom
/**
 * Every tab mounts against a complete store and shows its content: a cheap
 * guard against a view that goes blank on a missing field.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { makeStore } from './fixtures/prism';
import journey from '@/data/content/consumer_journey.json';
import pools from '@/data/content/profit_pools.json';

const STORE = vi.hoisted(() => ({ store: {} as unknown }));

vi.mock('@/hooks/usePrism', () => ({
  __esModule: true,
  default: () => STORE.store,
  PrismProvider: ({ children }: { children: unknown }) => children,
}));
// The Consumer Journey and the Explorer fetch their content: the API's answers, from the authored JSON.
vi.mock('@/lib/apiClient', () => ({
  getDiagnostics: vi.fn(async () => null),
  getDriverProposals: vi.fn(async () => null),
  saveMyProposal: vi.fn(async () => null),
  getJourneyContent: vi.fn(async () => ({
    version: 0, source: 'base', content: journey.tiles, contexts: journey.contexts,
  })),
  saveJourneyContent: vi.fn(),
  getExplorerViews: vi.fn(async () => ({ views: pools.views })),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

import ShiftAnalysis from '@/components/dashboard/ShiftAnalysis';
import Drivers from '@/components/dashboard/Drivers';
import ConsumerJourney from '@/components/dashboard/ConsumerJourney';
import HomeGate from '@/components/dashboard/HomeGate';
import ProfitPoolExplorer from '@/components/dashboard/ProfitPoolExplorer';

STORE.store = makeStore();

afterEach(() => cleanup());

describe('every tab mounts on a complete store', () => {
  it('Profit Pool Shift Analysis', () => {
    const { container } = render(<ShiftAnalysis isAdmin={false} />);
    expect(container.textContent).toContain('Fabric Clean');
  });

  it('Drivers', () => {
    const { container } = render(<Drivers />);
    expect(container.textContent).toContain('Private Label Share Gain');
  });

  it('Consumer Journey', async () => {
    const { container, findByText } = render(<ConsumerJourney />);
    expect(container.textContent).toContain('Where Profit Pools Shift Along the Journey');
    expect(await findByText('AI stain/fabric recognition apps')).toBeTruthy();
  });

  it('Profit Pool Explorer, whose card says what the view covers rather than repeating the group', async () => {
    const { container, findByText } = render(<ProfitPoolExplorer />);
    expect(await findByText('Laundry Care: Industry Value Chain Profit Pool')).toBeTruthy();
    expect(container.textContent).toContain('Value Chain · revenue pool ~€277bn');
  });

  it('the entry gate', () => {
    const { container } = render(<HomeGate active onNavigate={() => {}} />);
    expect(container.textContent).toContain('Drivers');
  });
});
