// @vitest-environment jsdom
/**
 * The PNG export renders a node through html-to-image at twice the pixel
 * density on the surface the caller names, leaves out what print leaves out
 * (`data-print-hide`), marks the node `data-exporting` while it runs and
 * hands the renderer's failure back to the caller.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const renderer = vi.hoisted(() => ({
  toPng: vi.fn(),
  seen: { exportingDuringCapture: null as boolean | null },
}));
vi.mock('html-to-image', () => ({ toPng: renderer.toPng }));

import { downloadNodeAsPng, exportFilter } from '@/lib/exportImage';

type Options = { filter?: (n: HTMLElement) => boolean; pixelRatio?: number; backgroundColor?: string; height?: number;
  style?: Record<string, string> };

describe('downloadNodeAsPng', () => {
  let node: HTMLDivElement;
  let clicks: string[];

  beforeEach(() => {
    document.body.innerHTML = '';
    node = document.createElement('div');
    node.innerHTML = '<div data-print-hide>toolbar</div><table><tr><td>cell</td></tr></table>';
    document.body.appendChild(node);
    clicks = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(`${this.download}:${this.href}`);
    });
    renderer.toPng.mockReset();
    renderer.toPng.mockImplementation(async (n: HTMLElement) => {
      renderer.seen.exportingDuringCapture = n.hasAttribute('data-exporting');
      return 'data:image/png;base64,AAAA';
    });
  });

  it('renders at pixel ratio 2 on the given surface, without the print-hidden parts, and downloads the result', async () => {
    // jsdom lays nothing out: the height the node reports while it carries
    // the exporting mark (its controls hidden by the stylesheet) is what the image gets.
    let measuredWhileExporting = false;
    node.getBoundingClientRect = () => {
      measuredWhileExporting = node.hasAttribute('data-exporting');
      return { height: 640.4 } as DOMRect;
    };
    await downloadNodeAsPng(node, 'matrix.png', { backgroundColor: '#ffffff' });
    expect(renderer.toPng).toHaveBeenCalledTimes(1);
    const [target, options] = renderer.toPng.mock.calls[0] as [HTMLElement, Options];
    expect(target).toBe(node);
    expect(options.pixelRatio).toBe(2);
    expect(options.backgroundColor).toBe('#ffffff');
    expect(options.filter!(node.querySelector('[data-print-hide]') as HTMLElement)).toBe(false);
    expect(options.filter!(node.querySelector('td') as HTMLElement)).toBe(true);
    expect(options.height).toBe(641);
    expect(measuredWhileExporting).toBe(true);
    expect(renderer.seen.exportingDuringCapture).toBe(true);
    expect(node.hasAttribute('data-exporting')).toBe(false);
    expect(clicks).toEqual(['matrix.png:data:image/png;base64,AAAA']);
  });

  it('captures the whole content of a scroll container when asked', async () => {
    Object.defineProperty(node, 'scrollHeight', { value: 1234, configurable: true });
    await downloadNodeAsPng(node, 'panel.png', { backgroundColor: '#f8f9ff', expandScroll: true, pixelRatio: 1 });
    const options = renderer.toPng.mock.calls[0][1] as Options;
    expect(options.height).toBe(1234);
    expect(options.style).toEqual({ height: 'auto', maxHeight: 'none', overflow: 'visible' });
    expect(options.pixelRatio).toBe(1);
  });

  it('gives focus back to the control that started the export, which the capture hides', async () => {
    const button = document.createElement('button');
    button.setAttribute('data-print-hide', '');
    node.appendChild(button);
    button.focus();
    renderer.toPng.mockImplementation(async () => {
      // The stylesheet hides the toolbar while the image renders; the browser then drops its focus.
      (document.activeElement as HTMLElement).blur();
      return 'data:image/png;base64,AAAA';
    });
    await downloadNodeAsPng(node, 'matrix.png', { backgroundColor: '#ffffff' });
    expect(document.activeElement).toBe(button);
  });

  it('leaves the status regions out of the image', () => {
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    expect(exportFilter()(status)).toBe(false);
  });

  it('hands the renderer\'s failure back and clears the exporting mark', async () => {
    renderer.toPng.mockRejectedValue(new Error('tainted canvas'));
    await expect(downloadNodeAsPng(node, 'x.png', { backgroundColor: '#ffffff' })).rejects.toThrow('tainted canvas');
    expect(node.hasAttribute('data-exporting')).toBe(false);
    expect(clicks).toEqual([]);
  });

  it('combines the caller\'s exclusions with the print rule', () => {
    const filter = exportFilter((n) => n.tagName !== 'TABLE');
    expect(filter(node.querySelector('[data-print-hide]') as HTMLElement)).toBe(false);
    expect(filter(node.querySelector('table') as HTMLElement)).toBe(false);
    expect(filter(node.querySelector('td') as HTMLElement)).toBe(true);
    // Text nodes reach the filter too; they have no attributes.
    expect(filter(document.createTextNode('x') as unknown as HTMLElement)).toBe(true);
  });
});
