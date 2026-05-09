/**
 * Client-only embedded wallet creation per app chain.
 * Only the public address is sent to the server; secrets stay in the modal until dismissed.
 */
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { AppChainId } from '@/lib/chains/appChain';
import { generateEmbeddedTonWallet } from '@/lib/ton/tonEmbeddedCreate';

export type GeneratedEmbeddedWallet = {
  address: string;
  /**
   * Human-copiable secret for backup:
   * - TON: 64-char hex (32-byte ed25519 seed)
   * - Solana: base58-encoded 64-byte secret key (standard export shape)
   * - EVM: 0x-prefixed 32-byte hex private key
   */
  privateKeyDisplay: string;
};

export async function generateEmbeddedWalletForChain(chain: AppChainId): Promise<GeneratedEmbeddedWallet> {
  if (chain === 'ton') {
    const w = await generateEmbeddedTonWallet();
    return { address: w.address, privateKeyDisplay: w.privateKeyHex };
  }
  if (chain === 'sol') {
    const kp = Keypair.generate();
    return {
      address: kp.publicKey.toBase58(),
      privateKeyDisplay: bs58.encode(kp.secretKey),
    };
  }
  if (chain === 'bnb' || chain === 'base') {
    const pk = generatePrivateKey();
    const acct = privateKeyToAccount(pk);
    return {
      address: acct.address.toLowerCase(),
      privateKeyDisplay: pk,
    };
  }
  throw new Error('unsupported_chain');
}
