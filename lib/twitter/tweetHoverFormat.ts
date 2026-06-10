/** Axiom / Terminal tweet-hover number + clock formatting (client-safe, no server-only). */

export function formatAxiomEngagement(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    const s = v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return `${s.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1')}M`;
  }
  if (n >= 10_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(2).replace(/\.00$/, '')}K`;
  }
  return String(Math.round(n));
}

/** Axiom clock row — e.g. `Jun 8, 2026, 8:28 PM`. */
export function formatAxiomTweetTimestamp(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const year = d.getFullYear();
  const time = d.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${month} ${day}, ${year}, ${time}`;
}

export function formatAxiomFollowers(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2).replace(/\.00$/, '')}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2).replace(/\.00$/, '')}K`;
  return String(Math.round(n));
}

export function formatAxiomJoined(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
