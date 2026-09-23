// @vitest-environment jsdom
/**
 * Every tab mounts against a complete store and shows its content: a cheap
 * guard against a view that goes blank on a missing field.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { makeStore } from './fixtures/prism';

const STORE = vi.hoisted(() => ({ store: {} as unknown }));

vi.mock('@/hooks/usePrism', () => ({
  __esModule: true,
  default: () => STORE.store,
  PrismProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/apiClient', () => ({
  getDiagnostics: vi.fn(async () => null),
  getDriverProposals: vi.fn(async () => null),
  saveMyProposal: vi.fn(async () => null),
  getJourneyContent: vi.fn(async () => ({ version: 0, content: null })),
  saveJourneyContent: vi.fn(),
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

STORE.store = makeStore();

afterEach(() => cleanup());

describe('every tab mounts on a complete store', () => {
  it('Profit Pool Shift Analysis', () => {
    const { container } = render(<ShiftAnalysis isAdmin={false} />);
    expect(container.textContent).toContain('Fabric Clean');
  });

  it('Drivers', () => {
    const { container } = render(<Drivers />);
    expect(container.textContent).toContain('Private label structural penetration');
  });

  it('Consumer Journey', async () => {
    const { container, findByText } = render(<ConsumerJourney />);
    expect(container.textContent).toContain('Where Profit Pools Shift Along the Journey');
    expect(await findByText('AI stain/fabric recognition apps')).toBeTruthy();
  });

  it('the entry gate', () => {
    const { container } = render(<HomeGate active onNavigate={() => {}} />);
    expect(container.textContent).toContain('Drivers');
  });
});
