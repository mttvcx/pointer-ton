/**
 * DEMO PULSE DATA — fake, deterministic fixtures so the Advanced screener
 * (components/PulseBoard.tsx) is never empty when the live /api/pulse/feed call
 * fails, returns nothing, or the user isn't signed in.
 *
 * Everything here is CLEARLY FAKE: mints are deterministic look-alike base58
 * strings (not real on-chain accounts), and image_url is intentionally null so
 * CoinIcon renders its clean symbol-avatar fallback instead of fetching broken
 * remote logos. Numbers are hand-tuned to look alive in the VOL / MC row.
 *
 * Shapes match src/types.ts EXACTLY (TokenRow + TokenSnapshot, all required
 * fields present). Pure data — no web/DOM imports, only the types import.
 *
 * Inspired by current SOL memecoin culture (piss, SPCX69, catwifhat, HTML,
 * XGIFT, world.xyz, trust-me-bro, RTM, …). Different tokens per column.
 */

import type { PulseBundle, PulseColumn, TokenRow, TokenSnapshot } from '../types';

// Stamped once at module load so the relative ISO ages stay stable per session.
const NOW = Date.now();

/** ISO string for `mins` minutes ago (deterministic relative to module load). */
function minsAgo(mins: number): string {
  return new Date(NOW - mins * 60_000).toISOString();
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Deterministic colorful demo avatar per symbol (so rows show a pic, not a
 * letter). Swap for real token logos when the live feed provides image_url. */
function demoPic(symbol: string): string {
  return `https://api.dicebear.com/9.x/shapes/png?seed=${encodeURIComponent(symbol)}&size=120`;
}

/**
 * Build a fake, valid-LOOKING base58 mint (~44 chars) deterministically from a
 * seed so it's stable across renders but obviously not a real account. The seed
 * is woven in verbatim so the string reads as fake on inspection.
 */
function fakeMint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  let out = `D3mo${seed}`;
  let x = Math.abs(h) || 7;
  while (out.length < 44) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const ch = BASE58[x % BASE58.length] ?? '1';
    out += ch;
  }
  return out.slice(0, 44);
}

type Pad = 'pump' | 'bonk' | 'moonshot';

type DemoSpec = {
  seed: string;
  symbol: string;
  name: string;
  pad: Pad;
  twitter: string | null;
  website: string | null;
  telegram: string | null;
  /** 0..100 for new/stretch, null for migrated. */
  bonding: number | null;
  ageMins: number;
  mc: number;
  price: number;
  liq: number;
  vol: number;
  holders: number;
};

function toBundle(d: DemoSpec): PulseBundle {
  const token: TokenRow = {
    mint: fakeMint(d.seed),
    symbol: d.symbol,
    name: d.name,
    decimals: 6,
    image_url: demoPic(d.symbol),
    description: null,
    twitter_handle: d.twitter,
    telegram_url: d.telegram,
    website_url: d.website,
    creator_wallet: null,
    launch_pad: d.pad,
    raw_metadata: null,
    is_lp_locked: null,
    mint_authority: null,
    freeze_authority: null,
    bonding_progress: d.bonding,
    created_at: minsAgo(d.ageMins),
  };
  const snapshot: TokenSnapshot = {
    market_cap_usd: d.mc,
    price_usd: d.price,
    liquidity_usd: d.liq,
    volume_24h_usd: d.vol,
    holder_count: d.holders,
    top10_holder_pct: null,
    dev_holding_pct: null,
    extended_metrics: null,
    snapshot_at: minsAgo(Math.min(d.ageMins, 3)),
  };
  return { token, snapshot };
}

// ---- NEW: fresh launches, low MC, high bonding churn ----------------------
const NEW: DemoSpec[] = [
  { seed: 'PISS', symbol: '$piss', name: 'pisscoin', pad: 'pump', twitter: 'pisscoinsol', website: 'https://piss.lol', telegram: null, bonding: 41, ageMins: 4, mc: 28_400, price: 0.0000284, liq: 12_300, vol: 61_200, holders: 214 },
  { seed: 'SPCX69', symbol: '$SPCX69', name: 'space x 69', pad: 'pump', twitter: 'spcx69', website: null, telegram: 'https://t.me/spcx69', bonding: 17, ageMins: 7, mc: 11_900, price: 0.0000119, liq: 6_800, vol: 24_700, holders: 96 },
  { seed: 'HTML', symbol: '$HTML', name: 'hypertext markup', pad: 'bonk', twitter: 'htmlcoin', website: 'https://html.wtf', telegram: null, bonding: 63, ageMins: 11, mc: 47_200, price: 0.0000472, liq: 19_400, vol: 102_500, holders: 388 },
  { seed: 'XGIFT', symbol: '$XGIFT', name: 'x gift', pad: 'moonshot', twitter: 'xgift_sol', website: null, telegram: null, bonding: 9, ageMins: 2, mc: 7_100, price: 0.0000071, liq: 4_200, vol: 18_900, holders: 51 },
  { seed: 'CATWIF', symbol: '$CATWIF', name: 'catwifhat', pad: 'pump', twitter: 'catwifhatsol', website: 'https://catwif.cat', telegram: 'https://t.me/catwifhat', bonding: 55, ageMins: 14, mc: 39_800, price: 0.0000398, liq: 16_100, vol: 88_300, holders: 305 },
  { seed: 'TMB', symbol: '$TMB', name: 'trust me bro', pad: 'bonk', twitter: 'trustmebro', website: null, telegram: null, bonding: 28, ageMins: 6, mc: 19_600, price: 0.0000196, liq: 9_900, vol: 43_100, holders: 162 },
  { seed: 'RTM', symbol: '$RTM', name: 'read the memo', pad: 'pump', twitter: null, website: 'https://rtm.fun', telegram: null, bonding: 72, ageMins: 19, mc: 58_300, price: 0.0000583, liq: 23_700, vol: 131_400, holders: 471 },
  { seed: 'WIFI', symbol: '$WIFI', name: 'wifi inu', pad: 'moonshot', twitter: 'wifi_inu', website: null, telegram: null, bonding: 34, ageMins: 9, mc: 22_700, price: 0.0000227, liq: 10_400, vol: 49_800, holders: 188 },
];

// ---- STRETCH: nearly bonded, mid MC, heating volume ----------------------
const STRETCH: DemoSpec[] = [
  { seed: 'WORLD', symbol: '$world.xyz', name: 'world dot xyz', pad: 'pump', twitter: 'worldxyz', website: 'https://world.xyz', telegram: null, bonding: 91, ageMins: 38, mc: 174_000, price: 0.000174, liq: 71_500, vol: 412_000, holders: 1_204 },
  { seed: 'GROK7', symbol: '$GROK7', name: 'grok seven', pad: 'bonk', twitter: 'grok7coin', website: null, telegram: 'https://t.me/grok7', bonding: 84, ageMins: 52, mc: 132_500, price: 0.0001325, liq: 58_200, vol: 318_700, holders: 942 },
  { seed: 'FARTX', symbol: '$FARTX', name: 'fart index', pad: 'pump', twitter: 'fartindex', website: 'https://fart.lol', telegram: null, bonding: 96, ageMins: 27, mc: 221_300, price: 0.0002213, liq: 89_400, vol: 567_900, holders: 1_633 },
  { seed: 'NPC', symbol: '$NPC', name: 'non player coin', pad: 'moonshot', twitter: null, website: null, telegram: 'https://t.me/npccoin', bonding: 78, ageMins: 64, mc: 98_600, price: 0.0000986, liq: 41_700, vol: 244_100, holders: 711 },
  { seed: 'MOG2', symbol: '$MOG2', name: 'mog season two', pad: 'pump', twitter: 'mogseason2', website: 'https://mog2.gg', telegram: null, bonding: 88, ageMins: 44, mc: 156_800, price: 0.0001568, liq: 64_900, vol: 371_200, holders: 1_088 },
  { seed: 'GIGA', symbol: '$GIGA', name: 'gigachad jr', pad: 'bonk', twitter: 'gigachadjr', website: null, telegram: null, bonding: 93, ageMins: 31, mc: 198_400, price: 0.0001984, liq: 81_200, vol: 489_500, holders: 1_421 },
  { seed: 'PNUT2', symbol: '$PNUT2', name: 'peanut returns', pad: 'pump', twitter: 'peanutreturns', website: 'https://pnut2.xyz', telegram: 'https://t.me/pnut2', bonding: 80, ageMins: 58, mc: 113_900, price: 0.0001139, liq: 49_300, vol: 271_600, holders: 826 },
  { seed: 'LMAO', symbol: '$LMAO', name: 'laughing on chain', pad: 'moonshot', twitter: null, website: null, telegram: null, bonding: 86, ageMins: 49, mc: 144_200, price: 0.0001442, liq: 60_100, vol: 339_800, holders: 998 },
];

// ---- MIGRATED: graduated to AMM, higher MC, bonding null -------------------
const MIGRATED: DemoSpec[] = [
  { seed: 'CHILLG', symbol: '$CHILLGUY', name: 'just a chill guy', pad: 'pump', twitter: 'chillguysol', website: 'https://chillguy.lol', telegram: null, bonding: null, ageMins: 372, mc: 4_200_000, price: 0.0042, liq: 612_000, vol: 2_840_000, holders: 9_104 },
  { seed: 'MOODENG', symbol: '$MOODENG', name: 'moo deng', pad: 'bonk', twitter: 'moodengsol', website: null, telegram: 'https://t.me/moodeng', bonding: null, ageMins: 1_488, mc: 11_700_000, price: 0.0117, liq: 1_340_000, vol: 6_120_000, holders: 21_388 },
  { seed: 'POPCAT2', symbol: '$POPCAT', name: 'popcat redux', pad: 'pump', twitter: 'popcatredux', website: 'https://popcat.click', telegram: null, bonding: null, ageMins: 2_904, mc: 8_300_000, price: 0.0083, liq: 980_000, vol: 4_510_000, holders: 16_742 },
  { seed: 'GIGACH', symbol: '$GIGA', name: 'gigachad', pad: 'moonshot', twitter: 'gigachadcoin', website: null, telegram: null, bonding: null, ageMins: 744, mc: 2_960_000, price: 0.00296, liq: 487_000, vol: 1_910_000, holders: 7_220 },
  { seed: 'PNUTM', symbol: '$PNUT', name: 'peanut the squirrel', pad: 'pump', twitter: 'pnutsquirrel', website: 'https://pnut.fun', telegram: 'https://t.me/pnut', bonding: null, ageMins: 4_320, mc: 19_400_000, price: 0.0194, liq: 2_010_000, vol: 9_870_000, holders: 33_905 },
  { seed: 'FWOG2', symbol: '$FWOG', name: 'fwog', pad: 'bonk', twitter: 'fwogonsol', website: null, telegram: null, bonding: null, ageMins: 1_020, mc: 5_650_000, price: 0.00565, liq: 731_000, vol: 3_180_000, holders: 12_460 },
  { seed: 'GOATM', symbol: '$GOAT', name: 'goatseus maximus', pad: 'pump', twitter: 'goatseus', website: 'https://goat.win', telegram: null, bonding: null, ageMins: 6_120, mc: 27_800_000, price: 0.0278, liq: 2_640_000, vol: 13_400_000, holders: 41_217 },
  { seed: 'RETARDIO', symbol: '$RETARDIO', name: 'retardio', pad: 'moonshot', twitter: 'retardiocoin', website: null, telegram: 'https://t.me/retardio', bonding: null, ageMins: 2_160, mc: 6_900_000, price: 0.0069, liq: 842_000, vol: 3_720_000, holders: 14_033 },
];

/** Demo bundles keyed by Pulse column. */
export const DEMO_PULSE: Record<PulseColumn, PulseBundle[]> = {
  new: NEW.map(toBundle),
  stretch: STRETCH.map(toBundle),
  migrated: MIGRATED.map(toBundle),
};

/** Fresh demo bundles for a Pulse column. Always returns a non-empty array. */
export function getDemoPulse(column: PulseColumn): PulseBundle[] {
  const specs = column === 'new' ? NEW : column === 'stretch' ? STRETCH : MIGRATED;
  return specs.map(toBundle);
}
