import type { ParsedTweetSignals, TweetIntentClassification } from '@/lib/track/automation/types';

/**
 * Lightweight classifier — replace with model-assisted layer that returns structured JSON + score.
 */
export function classifyTweetIntentHeuristic(
  text: string,
  signals: ParsedTweetSignals,
): TweetIntentClassification {
  const t = text.toLowerCase();

  if (signals.scamLikelihoodHint > 0.55) {
    return { bucket: 'irrelevant', confidence01: 0.62, notes: 'scam-language-heuristic' };
  }

  if (signals.contracts.length > 0 && (t.includes('launch') || t.includes('live') || signals.launchVerbosityScore > 0.4)) {
    return { bucket: 'launch_announcement', confidence01: 0.78, notes: 'ca+launch-verbs' };
  }

  if (signals.contracts.length > 0 || signals.urls.some((u) => /pump\.fun|dexscreener/i.test(u))) {
    return { bucket: 'token_call', confidence01: 0.72, notes: 'ca-or-launchpad-link' };
  }

  if (signals.tickers.length > 0 && /\b(buy|ape|entry|added|call)\b/.test(t)) {
    return { bucket: 'token_call', confidence01: 0.55, notes: 'ticker+trader-verbs' };
  }

  if (/\b(breaking|sec|etf|partnership|listing)\b/.test(t)) {
    return { bucket: 'news_catalyst', confidence01: 0.5, notes: 'macro-keywords' };
  }

  if (signals.urgencyScore > 0.55) {
    return { bucket: 'kol_signal', confidence01: 0.45, notes: 'urgency-only' };
  }

  return { bucket: 'irrelevant', confidence01: 0.35, notes: 'no-strong-signal' };
}
