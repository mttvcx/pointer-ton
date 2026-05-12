import type { ParsedTweetSignals } from '@/lib/track/automation/types';

const SOL_MINTLIKE_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,48}\b/g;
const EVM_ADDR_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const TON_FRIENDLY_RE = /\b(?:EQ|UQ)[A-Za-z0-9_-]{40,}\b/g;

const URL_RE = /\bhttps?:\/\/[^\s)>]+|(?:www\.)[^\s)>]+/gi;

const LAUNCH_PHRASES =
  /\b(ca\s*below|contract\s*below|live\s*now|just\s+launched|now\s+live|mint\s*live|deployed|bonding\s*curve|pump\.fun|dexscreener)\b/i;

const SCAMISH =
  /\b(guaranteed|100x|instant\s+profit|send\s+(?:eth|sol|ton)|airdrop\s+claimer|whitelist\s+free)\b/i;

const TICKER_RAW_RE = /\$([A-Z0-9]{2,10})\b/g;

const URL_LAUNCH_HINT =
  /\b(pump\.fun|dexscreener\.com|dex\s*screener|birdeye\.so|moonshot|axiom|photon)\b/i;

function uniq(xs: string[]): string[] {
  return [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
}

/**
 * Deterministic extraction — upstream AI must never replace these paths.
 */
export function parseTweetDeterministicSignals(text: string, extraUrls?: string[]): ParsedTweetSignals {
  const block = `${text}\n${(extraUrls ?? []).join('\n')}`;
  const lower = block.toLowerCase();

  const contractsSol = uniq(block.match(SOL_MINTLIKE_RE) ?? []);
  const contractsEvm = uniq(block.match(EVM_ADDR_RE) ?? []).map((a) => a.toLowerCase());
  const contractsTon = uniq(block.match(TON_FRIENDLY_RE) ?? []);
  const contracts = uniq([...contractsSol, ...contractsEvm, ...contractsTon]);

  const tickers: string[] = [];
  for (const m of block.matchAll(TICKER_RAW_RE)) {
    const sym = m[1];
    if (sym) tickers.push(sym.toUpperCase());
  }

  const urls = uniq([...(block.match(URL_RE) ?? []), ...(extraUrls ?? [])]);

  let urgencyScore = 0;
  if (/\b(urgent|now|asap|hurry|first)\b/i.test(block)) urgencyScore += 0.15;
  if (LAUNCH_PHRASES.test(block)) urgencyScore += 0.35;
  if (contracts.length > 0) urgencyScore += 0.25;
  if (urls.some((u) => URL_LAUNCH_HINT.test(u))) urgencyScore += 0.2;
  urgencyScore = Math.min(1, urgencyScore);

  let scamLikelihoodHint = 0;
  if (SCAMISH.test(block)) scamLikelihoodHint += 0.45;
  if (/\bDm\s+me\b/i.test(block)) scamLikelihoodHint += 0.15;
  scamLikelihoodHint = Math.min(1, scamLikelihoodHint);

  let launchVerbosityScore = 0;
  if (LAUNCH_PHRASES.test(block)) launchVerbosityScore += 0.55;
  if (urls.some((u) => URL_LAUNCH_HINT.test(u))) launchVerbosityScore += 0.35;
  if (contracts.length > 0) launchVerbosityScore += 0.25;
  launchVerbosityScore = Math.min(1, launchVerbosityScore);

  const lowered = lower.split(/\s+/).filter((w) => w.length > 2);

  return {
    contracts,
    tickers: uniq(tickers),
    tokenNamesGuess: [],
    urls,
    lowered,
    urgencyScore,
    scamLikelihoodHint,
    launchVerbosityScore,
  };
}
