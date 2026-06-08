/**
 * Pointer Sandbox Mode v1 — type definitions.
 *
 * Everything here is FAKE. No value in this module maps to a real chain,
 * wallet, balance, or payout. Sandbox state lives only in the browser
 * (localStorage key `pointer-sandbox-v1`) and never touches Supabase, Privy,
 * Helius, Jupiter, or any `/api/trade|packs` route.
 */

export const SANDBOX_LEDGER_VERSION = 1;

export type SandboxTxStatus = 'confirmed';

/** A simulated on-chain transaction. Hash format: `SANDBOX_<ts>_<rand>`. */
export interface SandboxTx {
  hash: string;
  status: SandboxTxStatus;
  kind: 'buy' | 'sell' | 'pack' | 'split_allocate' | 'autobuy' | 'autolaunch';
  mint?: string;
  symbol?: string;
  walletId: string;
  /** SOL spent (buy) or received (sell), positive number. */
  amountSol: number;
  /** Token units moved. */
  amountToken?: number;
  createdAt: number;
  /** Simulated confirmation latency in ms (250–1800). */
  latencyMs: number;
  priorityFeeSol: number;
  platformFeeSol: number;
  slippageBps: number;
  route: 'sandbox';
}

export interface SandboxPosition {
  mint: string;
  symbol: string;
  walletId: string;
  /** Token units held. */
  amount: number;
  /** Weighted-average entry price in SOL per token. */
  avgPriceSol: number;
  /** Total SOL cost basis remaining for the held amount. */
  costBasisSol: number;
  updatedAt: number;
}

export interface SandboxTrade {
  id: string;
  txHash: string;
  walletId: string;
  mint: string;
  symbol: string;
  side: 'buy' | 'sell';
  priceSol: number;
  amountToken: number;
  amountSol: number;
  /** Realized PnL in SOL (sells only; 0 for buys). */
  realizedPnlSol: number;
  platformFeeSol: number;
  createdAt: number;
  source: 'manual' | 'autobuy' | 'pack';
}

export interface SandboxWallet {
  id: string;
  /** Fake address — never a real keypair. */
  address: string;
  label: string;
  isPrimary: boolean;
  solBalance: number;
  usdcBalance: number;
  createdAt: number;
}

export interface SandboxPackOpen {
  openId: string;
  packType: string;
  priceSol: number;
  highlightRarity: string;
  totalValueSol: number;
  rewards: { symbol: string; mint: string; valueSol: number }[];
  createdAt: number;
}

export interface SandboxAutomationEvent {
  id: string;
  kind: 'kol_signal' | 'autobuy' | 'autolaunch';
  handle?: string;
  text: string;
  mint?: string;
  symbol?: string;
  amountSol?: number;
  txHash?: string;
  createdAt: number;
}

/** Live entry in the simulated market. */
export interface SandboxMarketToken {
  mint: string;
  symbol: string;
  name: string;
  priceSol: number;
  /** Percent change since session start. */
  changePct: number;
  /** Recent prices for a mini sparkline. */
  spark: number[];
  /** Bias: pumpers trend up, dumpers trend down, others random-walk. */
  bias: 'pump' | 'dump' | 'neutral';
}

export interface SandboxChampionship {
  /** Pointer Trading Championship Score — sandbox-only, not official. */
  ptcs: number;
  trades: number;
  realizedPnlSol: number;
  bestTradePnlSol: number;
  updatedAt: number;
}

export interface SandboxLedgerState {
  version: number;
  createdAt: number;
  wallets: SandboxWallet[];
  activeWalletId: string;
  positions: SandboxPosition[];
  trades: SandboxTrade[];
  txs: SandboxTx[];
  packOpens: SandboxPackOpen[];
  automation: SandboxAutomationEvent[];
  championship: SandboxChampionship;
}
