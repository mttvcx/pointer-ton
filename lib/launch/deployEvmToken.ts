import 'server-only';

import { createWalletClient, createPublicClient, http, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, bsc, base } from 'viem/chains';
import type { LaunchPackageLaunchpad } from '@/lib/launch/types';

/**
 * EVM token deploy (ETH / BNB / Base) — the live counterpart to deployPumpToken.
 *
 * Signs with a server-held EVM burner (EVM_DEPLOY_WALLET_KEY) via viem, mirroring
 * the Solana deploy's key-never-touches-client model + explicit enable seatbelt.
 *
 * The last mile — the launchpad factory call — is intentionally a single seam
 * (`deployViaLaunchpad`). Each EVM launchpad (four.meme / clanker / flaunch / …)
 * has its own factory contract or API; we plug the verified address + ABI in
 * there rather than guessing (a wrong contract address burns real funds). Until a
 * factory is wired for the chosen launchpad, this throws `evm_launchpad_not_wired`
 * so nothing silently no-ops or misfires.
 */

export type EvmDeployChain = 'eth' | 'bnb' | 'base';

const VIEM_CHAIN: Record<EvmDeployChain, Chain> = { eth: mainnet, bnb: bsc, base: base };
/** clanker-supported chain ids (literals to satisfy the SDK's chainId union). */
const CLANKER_CHAIN_ID = { eth: 1, bnb: 56, base: 8453 } as const;

/** RPC URL per chain — env override, else the chain's public default. */
function rpcUrl(chain: EvmDeployChain): string {
  const env = {
    eth: process.env.ETH_RPC_URL,
    bnb: process.env.BSC_RPC_URL,
    base: process.env.BASE_RPC_URL,
  }[chain]?.trim();
  return env || VIEM_CHAIN[chain].rpcUrls.default.http[0]!;
}

/** A `0x`-prefixed EVM private key for the deploy burner. */
function deployPrivateKey(): `0x${string}` {
  const raw = process.env.EVM_DEPLOY_WALLET_KEY?.trim();
  if (!raw) throw new Error('evm_deploy_wallet_not_configured');
  const key = raw.startsWith('0x') ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('evm_deploy_wallet_invalid');
  return key as `0x${string}`;
}

export function evmDeployWalletConfigured(): boolean {
  return Boolean(process.env.EVM_DEPLOY_WALLET_KEY?.trim());
}

/** EVM auto-launch enabled (same two-seatbelt model as Solana). */
export function evmAutoLaunchEnabled(): boolean {
  return evmDeployWalletConfigured() && process.env.POINTER_EVM_LAUNCH_ENABLED?.trim() === '1';
}

export type DeployEvmTokenInput = {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string | null;
  twitter?: string | null;
  website?: string | null;
  launchpad: LaunchPackageLaunchpad;
  /** Dev buy in native units (ETH/BNB) — clamped by the caller. 0 = create only. */
  devBuyNative?: number;
};

export type DeployEvmTokenResult = { contractAddress: string; txHash: string; chain: EvmDeployChain };

function clients(chain: EvmDeployChain) {
  const account = privateKeyToAccount(deployPrivateKey());
  const transport = http(rpcUrl(chain));
  const wallet = createWalletClient({ account, chain: VIEM_CHAIN[chain], transport });
  const publicClient = createPublicClient({ chain: VIEM_CHAIN[chain], transport });
  return { account, wallet, publicClient };
}

/**
 * The launchpad-specific factory call. Wire each supported launchpad's verified
 * contract (address + ABI) here — e.g. four.meme's token manager (BNB), clanker's
 * factory (Base), flaunch (Base). Given `clients()` (a funded viem wallet), submit
 * the create tx and return the token address + tx hash.
 */
async function deployViaLaunchpad(
  chain: EvmDeployChain,
  input: DeployEvmTokenInput,
  c: ReturnType<typeof clients>,
): Promise<DeployEvmTokenResult> {
  // clanker — verified v4 factory (Ethereum / Base / BSC) via the maintained SDK,
  // signed by the server burner. Mirrors the client-side deployEvmClient path.
  if (input.launchpad === 'clanker') {
    const chainId = CLANKER_CHAIN_ID[chain];
    const { Clanker } = await import('clanker-sdk/v4');
    const clanker = new Clanker({ wallet: c.wallet, publicClient: c.publicClient } as unknown as ConstructorParameters<typeof Clanker>[0]);
    const socialMediaUrls = input.twitter ? [{ platform: 'x', url: input.twitter }] : [];
    const res = await clanker.deploy({
      name: input.name,
      symbol: input.symbol,
      image: input.imageUrl ?? '',
      chainId,
      tokenAdmin: c.account.address,
      metadata: { description: input.description ?? '', socialMediaUrls, auditUrls: [] },
    });
    if (res.error) throw new Error(res.error.message || 'clanker_deploy_failed');
    const waited = await res.waitForTransaction();
    if (waited.error) throw new Error(waited.error.message || 'clanker_confirm_failed');
    return { contractAddress: waited.address, txHash: res.txHash, chain };
  }

  // Other pads (four.meme / flaunch / uniswap / …) still need their verified
  // factory wired — throw rather than guess a contract (a wrong address burns funds).
  throw new Error(`evm_launchpad_not_wired:${input.launchpad}`);
}

export async function deployEvmToken(
  chain: EvmDeployChain,
  input: DeployEvmTokenInput,
): Promise<DeployEvmTokenResult> {
  const c = clients(chain); // throws if the burner key is missing/invalid
  return deployViaLaunchpad(chain, input, c);
}
