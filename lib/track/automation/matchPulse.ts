import type { MatchedPulseToken, ParsedTweetSignals } from '@/lib/track/automation/types';
import type { PulseTokenBundle } from '@/types/tokens';

/**
 * Best-effort match from live Pulse rows (client passes visible bundles).
 */
export function matchSignalsToPulseRows(
  signals: ParsedTweetSignals,
  rows: PulseTokenBundle[],
): MatchedPulseToken[] {
  const out: MatchedPulseToken[] = [];

  for (const ca of signals.contracts) {
    const hit = rows.find((b) => b.token.mint === ca);
    if (hit) {
      out.push({
        mint: hit.token.mint,
        symbol: hit.token.symbol,
        matchedBy: 'contract',
        score01: 0.95,
      });
    }
  }

  for (const tick of signals.tickers) {
    const t = tick.toUpperCase();
    const symHit = rows.find((b) => (b.token.symbol ?? '').toUpperCase() === t);
    if (symHit && !out.some((o) => o.mint === symHit.token.mint)) {
      out.push({
        mint: symHit.token.mint,
        symbol: symHit.token.symbol,
        matchedBy: 'ticker_symbol',
        score01: 0.55,
      });
    }
  }

  return out;
}
