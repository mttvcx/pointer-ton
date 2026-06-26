/** Canned data for the Expo Go demo (no API, no wallet). Numbers are illustrative. */

export type DemoToken = {
  id: string;
  sym: string;
  name: string;
  mc: string;
  price: string;
  chg: string;
  up: boolean;
  color: string;
  glyph: string;
  dark?: boolean;
};

export const DEMO_TOKENS: DemoToken[] = [
  { id: 'btc', sym: 'BTC', name: 'Bitcoin', mc: '$1.2T MC', price: '$60,798.32', chg: '3.32%', up: false, color: '#F7931A', glyph: '₿' },
  { id: 'eth', sym: 'ETH', name: 'Ethereum', mc: '$195B MC', price: '$1,616.88', chg: '3.29%', up: false, color: '#4B5563', glyph: 'Ξ' },
  { id: 'bnb', sym: 'BNB', name: 'BNB', mc: '$77B MC', price: '$565.16', chg: '2.25%', up: false, color: '#E3B321', glyph: 'B', dark: true },
  { id: 'xrp', sym: 'XRP', name: 'XRP', mc: '$65.5B MC', price: '$1.07', chg: '3.05%', up: false, color: '#ffffff', glyph: 'X', dark: true },
  { id: 'sol', sym: 'SOL', name: 'Solana', mc: '$32.9B MC', price: '$67.60', chg: '3.04%', up: false, color: '#9945FF', glyph: 'S' },
  { id: 'wif', sym: 'WIF', name: 'dogwifhat', mc: '$148.9M MC', price: '$0.149', chg: '4.89%', up: false, color: '#C98A5E', glyph: 'W' },
];

export type WeeklyTrade = {
  name: string;
  handle: string;
  color: string;
  initial: string;
  token: string;
  tokenColor: string;
  tokenInitial: string;
  amt: string;
  pnlPct: string;
  price: string;
  changePct: string;
  avgEntry: string;
  avgExit: string;
  thesis: string;
  txns: number;
  invested: string;
};

export const WEEKLY: WeeklyTrade[] = [
  { name: 's4if', handle: '@s4if', color: '#B5521E', initial: 's', token: 'ZERO', tokenColor: '#0A0A0A', tokenInitial: '0', amt: '+$77,860.93', pnlPct: '+3,328.67%', price: '$0.00318', changePct: '1,071.29%', avgEntry: '$0.000211', avgExit: '$0.00724', thesis: 'The coin rewriting a trillion-dollar industry.', txns: 25, invested: '$2,339.10' },
  { name: 'surveillor', handle: '@surveillor', color: '#1E63B5', initial: 'A', token: 'TERMI', tokenColor: '#2E7D32', tokenInitial: 'T', amt: '+$76,677.07', pnlPct: '+2,940.11%', price: '$0.0142', changePct: '812.40%', avgEntry: '$0.00120', avgExit: '$0.0142', thesis: 'Surveillance infra for the agent economy.', txns: 18, invested: '$3,102.50' },
  { name: 'smol_intern', handle: '@smol_intern', color: '#2E7D32', initial: 's', token: 'JOT', tokenColor: '#C9A21E', tokenInitial: 'J', amt: '+$57,613.69', pnlPct: '+91.00%', price: '$0.00610', changePct: '51.67%', avgEntry: '$0.00156', avgExit: '$0.00298', thesis: 'Patience on a blue-chip dog.', txns: 129, invested: '$63,308.28' },
];

export const CHIPS: string[] = ['Crypto', 'Perps', 'Trending', 'Most held', 'Graduated', 'Gainers'];

export const LEADERBOARD: { rank: number; name: string; handle: string; pnl: string; color: string; initial: string }[] = [
  { rank: 1, name: 'leo', handle: '@0xleo', pnl: '+$79,292.70', color: '#B5521E', initial: 'l' },
  { rank: 2, name: 'Gero', handle: '@0xg3ro', pnl: '+$53,057.52', color: '#4B5563', initial: 'G' },
  { rank: 3, name: 'liukai', handle: '@liukai', pnl: '+$40,136.82', color: '#B53A6E', initial: 'l' },
  { rank: 4, name: 'ZBZ', handle: '@ZBZB1993', pnl: '+$29,633.59', color: '#2E7D32', initial: 'Z' },
  { rank: 5, name: 'OHT', handle: '@_OHT_', pnl: '+$28,861.60', color: '#1E63B5', initial: 'O' },
  { rank: 6, name: 'juicy', handle: '@Juicycooks', pnl: '+$17,818.35', color: '#C0392B', initial: 'j' },
  { rank: 7, name: 'don1zzz', handle: '@don1zzz', pnl: '+$15,809.02', color: '#6E56CF', initial: 'd' },
  { rank: 8, name: 'Aeon', handle: '@aeon', pnl: '+$15,467.16', color: '#2A8C8C', initial: 'A' },
];

export const ONBOARD_TRADERS: { name: string; handle: string; pnl: string; followers: string; color: string; initial: string }[] = [
  { name: 'Pixel', handle: '@Pixel_', pnl: '+$512,045.59', followers: '16,599', color: '#C9A21E', initial: 'P' },
  { name: 'dark', handle: '@darkuwu', pnl: '+$510,484.53', followers: '16,791', color: '#B53A6E', initial: 'd' },
  { name: 'leyten', handle: '@leyten', pnl: '+$112,068.17', followers: '8,069', color: '#4B5563', initial: 'l' },
  { name: 'surveillor', handle: '@surveillor', pnl: '+$108,946.95', followers: '15,972', color: '#1E63B5', initial: 's' },
  { name: 'Aeon', handle: '@Cryptoaeon', pnl: '+$91,291.55', followers: '5,703', color: '#2E7D32', initial: 'A' },
];

export const DEMO_HOLDERS: { name: string; hold: string; value: string; chg: string; up: boolean; color: string; initial: string }[] = [
  { name: 'svntyxsvn', hold: '5d 10h avg. hold', value: '$32,941.70', chg: '46.54%', up: false, color: '#3A2E2E', initial: 's' },
  { name: 'zinceth', hold: '1d 15h avg. hold', value: '$4,109.26', chg: '43.81%', up: false, color: '#2C3550', initial: 'z' },
  { name: 'xism360', hold: '2d 23h avg. hold', value: '$3,970.17', chg: '6.26%', up: true, color: '#1E63B5', initial: 'x' },
  { name: 'facxts', hold: '10h 54m avg. hold', value: '$3,295.84', chg: '12.37%', up: true, color: '#5A3A2A', initial: 'f' },
  { name: 'guagemela', hold: '17h 56m avg. hold', value: '$2,958.59', chg: '23.00%', up: true, color: '#C9A21E', initial: 'g' },
];
