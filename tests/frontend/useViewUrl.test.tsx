// @vitest-environment jsdom
/**
 * The address bar as state (hooks/useViewUrl.tsx): a view's parameters are
 * written to the address, a push adds a history entry that Back undoes, a
 * replace does not, and a view rendered without the provider is unaffected.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import useViewUrl, { ViewUrlProvider, useViewParams } from '@/hooks/useViewUrl';

function Probe() {
  const { view, openView, href } = useViewUrl();
  const [params, setParams] = useViewParams('shift-analysis');
  return (
    <div>
      <span data-testid="view">{view}</span>
      <span data-testid="lens">{params.lens ?? 'none'}</span>
      <span data-testid="category">{params.category ?? 'none'}</span>
      <span data-testid="href">{href()}</span>
      <button type="button" onClick={() => setParams({ lens: 'force' })}>force</button>
      <button type="button" onClick={() => setParams({ category: 'LHC: FCN' }, { push: true })}>open</button>
      <button type="button" onClick={() => setParams({ category: null })}>close</button>
      <button type="button" onClick={() => openView('drivers')}>drivers</button>
    </div>
  );
}

const search = () => window.location.search;

beforeEach(() => { window.history.replaceState(null, '', '/dashboard'); });
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/dashboard');
});

describe('ViewUrlProvider', () => {
  it('starts from the address it is given and writes a replaced parameter', () => {
    render(
      <ViewUrlProvider initial={{ view: 'shift-analysis', params: { lens: 'time' } }}>
        <Probe />
      </ViewUrlProvider>,
    );
    expect(screen.getByTestId('view').textContent).toBe('shift-analysis');
    expect(screen.getByTestId('lens').textContent).toBe('time');
    const before = window.history.length;
    fireEvent.click(screen.getByText('force'));
    expect(screen.getByTestId('lens').textContent).toBe('force');
    expect(search()).toBe('?view=shift&lens=force');
    expect(window.history.length).toBe(before);
    expect(screen.getByTestId('href').textContent).toContain('/dashboard?view=shift&lens=force');
  });

  it('pushes an entry for a drill-down, which Back closes', async () => {
    window.history.replaceState(null, '', '/dashboard?view=shift&lens=time');
    render(
      <ViewUrlProvider initial={{ view: 'shift-analysis', params: { lens: 'time' } }}>
        <Probe />
      </ViewUrlProvider>,
    );
    const before = window.history.length;
    fireEvent.click(screen.getByText('open'));
    expect(search()).toBe('?view=shift&lens=time&category=LHC%3A+FCN');
    expect(window.history.length).toBe(before + 1);
    // Back: jsdom moves the address and fires popstate.
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(search()).toBe('?view=shift&lens=time');
    expect(screen.getByTestId('category').textContent).toBe('none');
    expect(screen.getByTestId('lens').textContent).toBe('time');
  });

  it('opening another view keeps the first view\'s parameters for its return', () => {
    render(
      <ViewUrlProvider initial={{ view: 'shift-analysis', params: { lens: 'region' } }}>
        <Probe />
      </ViewUrlProvider>,
    );
    fireEvent.click(screen.getByText('drivers'));
    expect(screen.getByTestId('view').textContent).toBe('drivers');
    expect(search()).toBe('?view=drivers');
    // The Shift Analysis slice is unchanged while another view is active.
    expect(screen.getByTestId('lens').textContent).toBe('region');
  });

  it('is inert without a provider', () => {
    render(<Probe />);
    fireEvent.click(screen.getByText('force'));
    expect(screen.getByTestId('lens').textContent).toBe('none');
    expect(search()).toBe('');
  });
});

describe('two writes in one handler', () => {
  function TwoWrites() {
    const [params, setParams] = useViewParams('shift-analysis');
    return (
      <div>
        <span data-testid="both">{params.lens ?? '-'}/{params.year ?? '-'}</span>
        <button type="button" onClick={() => { setParams({ lens: 'force' }); setParams({ year: '2031' }); }}>both</button>
      </div>
    );
  }
  it('build on each other rather than on the last render', () => {
    render(
      <ViewUrlProvider initial={{ view: 'shift-analysis', params: {} }}>
        <TwoWrites />
      </ViewUrlProvider>,
    );
    fireEvent.click(screen.getByText('both'));
    expect(screen.getByTestId('both').textContent).toBe('force/2031');
    expect(window.location.search).toBe('?view=shift&lens=force&year=2031');
  });
});
