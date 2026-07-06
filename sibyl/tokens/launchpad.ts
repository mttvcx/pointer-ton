/**
 * Launchpad / platform detection from a contract address. Most launchpads vanity-grind
 * every mint to a fixed suffix, so the CA itself tells you where a token was born —
 * Sibyl should recognize this on sight (pump.fun, bonk.fun, Bags, four.meme, …).
 */

export type LaunchpadInfo = {
  platform: string;
  chain: 'sol' | 'bnb' | 'eth' | 'base';
  /** One-line CT-native note about what this platform is. */
  note: string;
};

/** Solana vanity suffixes → platform (checked case-insensitively; base58). */
const SOL_SUFFIXES: Array<{ re: RegExp; platform: string; note: string }> = [
  { re: /pump$/i, platform: 'Pump.fun', note: 'Pump.fun bonding-curve launch — migrates to PumpSwap/Raydium at ~$69K.' },
  { re: /bonk$/i, platform: 'LetsBonk (bonk.fun)', note: 'bonk.fun / Raydium LaunchLab launch — BONK ecosystem.' },
  { re: /bags$/i, platform: 'Bags', note: 'Bags.fm launch — creator fee-share built in.' },
  { re: /moon$/i, platform: 'Moonshot', note: 'Moonshot launch (DexScreener) — card/Apple-Pay friendly.' },
  { re: /boop$/i, platform: 'Boop.fun', note: 'Boop.fun launch.' },
  { re: /daos$/i, platform: 'daos.fun', note: 'daos.fun — tokenized DAO fund, not a pure memecoin.' },
];

/** EVM suffix rules, keyed by chain. */
const EVM_SUFFIXES: Array<{ re: RegExp; platform: string; chain: LaunchpadInfo['chain']; note: string }> = [
  { re: /4444$/i, platform: 'four.meme', chain: 'bnb', note: 'four.meme launch on BSC — the pump.fun of BNB chain.' },
];

/**
 * Detect the launchpad a token was minted on from its address. Returns null when the
 * suffix matches no known platform. `chain` is a hint (used for EVM disambiguation).
 */
export function detectLaunchpad(address: string | null | undefined, chain?: string): LaunchpadInfo | null {
  const ca = (address ?? '').trim();
  if (!ca) return null;

  if (ca.startsWith('0x')) {
    for (const r of EVM_SUFFIXES) {
      if (r.re.test(ca)) return { platform: r.platform, chain: r.chain, note: r.note };
    }
    return null;
  }

  // Solana (base58).
  for (const r of SOL_SUFFIXES) {
    if (r.re.test(ca)) return { platform: r.platform, chain: 'sol', note: r.note };
  }
  return null;
}
