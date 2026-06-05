import { toPng } from 'html-to-image';

const MAX_DATA_URL_CHARS = 280_000;

/**
 * Capture the visible app shell for diagnostics. Excludes the diagnostics overlay.
 */
export async function captureDiagnosticsScreenshot(): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  try {
    const dataUrl = await toPng(document.body, {
      quality: 0.88,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      cacheBust: true,
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;
        if (node.dataset.diagnosticsOverlay != null) return false;
        if (node.closest('[data-diagnostics-overlay]')) return false;
        return true;
      },
    });
    if (!dataUrl || dataUrl.length > MAX_DATA_URL_CHARS) return null;
    return dataUrl;
  } catch {
    return null;
  }
}

export function downloadScreenshotDataUrl(dataUrl: string, filename?: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename ?? `pointer-diagnostics-${Date.now()}.png`;
  a.click();
}
