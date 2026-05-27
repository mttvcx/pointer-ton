/** Read theme RGB companion vars as `rgb(r, g, b)` for canvas/chart APIs. */
export function cssRgbFromVar(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!raw) return fallback;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return fallback;
  return `rgb(${parts.slice(0, 3).join(', ')})`;
}
