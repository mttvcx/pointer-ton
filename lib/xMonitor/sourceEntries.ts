/**
 * Selectable entries per feed source, for the X Monitor "Feed accounts" drill-in.
 * X pulls from the big seeded handle list; the others are curated defaults the
 * operator can toggle. Entry ids are what get stored in `sourceExclusions`.
 */
import { SEED_X_TRACKED_ACCOUNTS } from '@/lib/xMonitor/seedTrackedAccounts';
import type { FeedSource } from '@/store/xMonitorSettings';

export type SourceEntry = { id: string; label: string; sub?: string };

const NEWS: SourceEntry[] = [
  { id: 'watcherguru', label: 'Watcher.Guru' },
  { id: 'cointelegraph', label: 'Cointelegraph' },
  { id: 'coindesk', label: 'CoinDesk' },
  { id: 'theblock', label: 'The Block' },
  { id: 'decrypt', label: 'Decrypt' },
  { id: 'bloomberg', label: 'Bloomberg' },
  { id: 'reuters', label: 'Reuters' },
  { id: 'wsj', label: 'Wall Street Journal' },
  { id: 'cnbc', label: 'CNBC' },
  { id: 'forbes', label: 'Forbes Crypto' },
  { id: 'benzinga', label: 'Benzinga' },
  { id: 'unusual_whales', label: 'Unusual Whales' },
  { id: 'db', label: 'DB (DeItaone)' },
  { id: 'firstsquawk', label: 'First Squawk' },
  { id: 'solanafloor', label: 'SolanaFloor' },
  { id: 'blockworks', label: 'Blockworks' },
];

const AFFILIATES: SourceEntry[] = [
  { id: 'pumpdotfun', label: 'pump.fun' },
  { id: 'bonk_fun', label: 'bonk.fun' },
  { id: 'believeapp', label: 'Believe' },
  { id: 'moonshot', label: 'Moonshot' },
  { id: 'raydium', label: 'Raydium' },
  { id: 'jupiterexchange', label: 'Jupiter' },
  { id: 'meteora', label: 'Meteora' },
  { id: 'photonsol', label: 'Photon' },
  { id: 'bullx', label: 'BullX' },
  { id: 'axiomexchange', label: 'Axiom' },
  { id: 'gmgnai', label: 'GMGN' },
  { id: 'tradewithphoton', label: 'Photon Trade' },
  { id: 'dexscreener', label: 'DexScreener' },
  { id: 'birdeye_so', label: 'Birdeye' },
  { id: 'solscan', label: 'Solscan' },
  { id: 'padre', label: 'Padre' },
  { id: 'nova', label: 'Nova' },
  { id: 'trojanonsolana', label: 'Trojan' },
  { id: 'bonkbot', label: 'BonkBot' },
  { id: 'maestrobots', label: 'Maestro' },
  { id: 'bananagunbot', label: 'Banana Gun' },
  { id: 'sol_incinerator', label: 'Sol Incinerator' },
  { id: 'tensor_hq', label: 'Tensor' },
  { id: 'magiceden', label: 'Magic Eden' },
  { id: 'jito_sol', label: 'Jito' },
  { id: 'heliuslabs', label: 'Helius' },
  { id: 'phantom', label: 'Phantom' },
  { id: 'solflare_wallet', label: 'Solflare' },
  { id: 'backpack', label: 'Backpack' },
];

const TRUTH: SourceEntry[] = [
  { id: 'realdonaldtrump', label: 'Donald J. Trump', sub: '@realDonaldTrump' },
  { id: 'donaldjtrumpjr', label: 'Donald Trump Jr.', sub: '@DonaldJTrumpJr' },
  { id: 'erictrump', label: 'Eric Trump', sub: '@EricTrump' },
  { id: 'melaniatrump', label: 'Melania Trump', sub: '@MELANIATRUMP' },
  { id: 'dbongino', label: 'Dan Bongino', sub: '@dbongino' },
  { id: 'devinnunes', label: 'Devin Nunes', sub: '@DevinNunes' },
];

const INSTAGRAM: SourceEntry[] = [
  { id: 'cristiano', label: 'Cristiano Ronaldo' },
  { id: 'leomessi', label: 'Lionel Messi' },
  { id: 'kimkardashian', label: 'Kim Kardashian' },
  { id: 'kyliejenner', label: 'Kylie Jenner' },
  { id: 'therock', label: 'Dwayne Johnson' },
  { id: 'kingjames', label: 'LeBron James' },
  { id: 'snoopdogg', label: 'Snoop Dogg' },
  { id: 'iamcardib', label: 'Cardi B' },
];

const DISCORD: SourceEntry[] = [
  { id: 'alpha-group', label: 'Alpha Group', sub: '#alpha-calls' },
  { id: 'degen-lounge', label: 'Degen Lounge', sub: '#ca-drops' },
  { id: 'sniper-squad', label: 'Sniper Squad', sub: '#signals' },
  { id: 'inner-circle', label: 'Inner Circle', sub: '#gems' },
  { id: 'pointer-official', label: 'Pointer Official', sub: '#launches' },
];

const CA_TRACKER: SourceEntry[] = [
  { id: 'pumpfun-new', label: 'pump.fun · New' },
  { id: 'pumpfun-migrated', label: 'pump.fun · Migrated' },
  { id: 'bonkfun-new', label: 'bonk.fun · New' },
  { id: 'believe-new', label: 'Believe · New' },
  { id: 'raydium-lp', label: 'Raydium · New LP' },
  { id: 'moonshot-new', label: 'Moonshot · New' },
];

/** X handles as entries (2012 from the seed). */
const X_ENTRIES: SourceEntry[] = SEED_X_TRACKED_ACCOUNTS.map((h) => ({ id: h, label: `@${h}` }));

export const SOURCE_ENTRIES: Record<FeedSource, SourceEntry[]> = {
  x: X_ENTRIES,
  instagram: INSTAGRAM,
  truth: TRUTH,
  caTracker: CA_TRACKER,
  news: NEWS,
  affiliates: AFFILIATES,
  discord: DISCORD,
};
