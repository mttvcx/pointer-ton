import 'server-only';

/**
 * Default X handles the monitor always polls, so the feed streams out of the box
 * (no rule required). Users' own rule handles are added on top of these.
 * Curated crypto/KOL accounts — edit freely; keep it tight to respect the API
 * read budget (Basic ≈ 15k reads/mo ≈ 500 new tweets/day across all handles).
 */
export const DEFAULT_MONITOR_HANDLES: string[] = [
  // Majors / signal
  'elonmusk',
  'realDonaldTrump',
  'aeyakovenko', // Anatoly (Solana)
  'rajgokal',
  'JupiterExchange',
  'pumpdotfun',
  // Trader KOLs
  'cented7',
  'ripjalens',
  'cupseyy',
  'gh0stee',
  'kadenox',
  'zxduckyxyz',
  'lynk0x',
  'absolquant',
  'leensx100',
  'the__solstice',
  'qtdegen',
  '404flipped',
];
