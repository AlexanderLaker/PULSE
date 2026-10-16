/**
 * PNG export of a piece of the page, shared by the views: a card, a panel or
 * a chart, rendered at twice the pixel density on the surface colour the
 * caller names. html-to-image is loaded on first use, so it stays out of the
 * initial bundle.
 *
 * While the capture runs the node carries `data-exporting`: anything inside
 * it marked `data-print-hide` (toolbars, export buttons, hover cards) is
 * hidden on the page and left out of the image, as it is in print, and a
 * note marked `data-print-only` is shown, as in print.
 */

export interface PngExportOptions {
  /** The background the image is painted on (a theme surface token). */
  backgroundColor: string;
  /** Device pixels per CSS pixel; 2 by default. */
  pixelRatio?: number;
  /** Leaves out more than the `data-print-hide` elements: return false to drop a node and its children. */
  filter?: (node: HTMLElement) => boolean;
  /** For a scroll container: capture its whole content, not the visible part. */
  expandScroll?: boolean;
}

/** Whether a node is kept in the image: everything but the `data-print-hide`
 *  elements, the status regions (feedback on a control, never evidence) and
 *  the caller's exclusions. */
export function exportFilter(extra?: (node: HTMLElement) => boolean) {
  return (node: HTMLElement): boolean => {
    if (typeof node.hasAttribute === 'function') {
      if (node.hasAttribute('data-print-hide') || node.getAttribute('role') === 'status') return false;
    }
    return extra ? extra(node) : true;
  };
}

/**
 * Renders a node to a PNG and downloads it. Rejects with the renderer's
 * error, which the caller reports in a status message.
 */
export async function downloadNodeAsPng(node: HTMLElement, filename: string, options: PngExportOptions): Promise<void> {
  const { toPng } = await import('html-to-image');
  // The control that started the export is among those hidden while it
  // renders, so the focus it held is given back afterwards.
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  node.setAttribute('data-exporting', '');
  try {
    // The renderer copies every element's computed size into its clone, so
    // the controls the image leaves out are hidden on the live page while it
    // renders (app/globals.css, data-exporting): otherwise their rows would
    // stay in the image as gaps and the measured height would be short. The
    // height is measured once they are hidden.
    const height = options.expandScroll ? node.scrollHeight : Math.ceil(node.getBoundingClientRect().height);
    const expand = options.expandScroll ? { style: { height: 'auto', maxHeight: 'none', overflow: 'visible' } } : {};
    const dataUrl = await toPng(node, {
      pixelRatio: options.pixelRatio ?? 2,
      backgroundColor: options.backgroundColor,
      cacheBust: true,
      filter: exportFilter(options.filter),
      height,
      ...expand,
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    node.removeAttribute('data-exporting');
    if (focused && focused.isConnected && (document.activeElement === document.body || document.activeElement === null)) {
      focused.focus({ preventScroll: true });
    }
  }
}
