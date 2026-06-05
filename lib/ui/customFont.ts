const FONT_LINK_ID = 'pointer-custom-font-link';

/** Apply a Google Fonts (or any CSS) URL to the document. */
export function applyCustomFontUrl(url: string): void {
  if (typeof document === 'undefined') return;
  const trimmed = url.trim();
  const existing = document.getElementById(FONT_LINK_ID);
  if (!trimmed) {
    existing?.remove();
    document.documentElement.style.removeProperty('font-family');
    return;
  }
  let link = existing as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  link.href = trimmed;
  document.documentElement.style.setProperty(
    'font-family',
    'var(--pointer-custom-font, ui-sans-serif, system-ui, sans-serif)',
  );
}

export function readStoredCustomFontUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem('pointer.shellPrefs');
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { state?: { customFontUrl?: string } };
    return typeof parsed.state?.customFontUrl === 'string' ? parsed.state.customFontUrl : '';
  } catch {
    return '';
  }
}
