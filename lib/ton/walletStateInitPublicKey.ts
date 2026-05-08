import 'server-only';
import type { StateInit } from '@ton/core';
import {
  WalletContractV3R2,
  WalletContractV4,
  WalletContractV5R1,
} from '@ton/ton';
import { loadWalletIdV5R1 } from '@ton/ton/dist/wallets/v5r1/WalletV5R1WalletId';
import type { TonConnectNetwork } from '@/lib/ton/tonLiteClient';

const dummyKey = Buffer.alloc(32);

const codeV3R2 = WalletContractV3R2.create({ workchain: 0, publicKey: dummyKey }).init.code;
const codeV4 = WalletContractV4.create({ workchain: 0, publicKey: dummyKey }).init.code;
const codeV5R1 = WalletContractV5R1.create({ publicKey: dummyKey }).init.code;

/**
 * Parse wallet Ed25519 public key from standard wallet state init (no chain RPC).
 * Matches Ton Connect demo-dapp behavior before calling get_public_key.
 */
export function tryParsePublicKeyFromStateInit(
  stateInit: StateInit,
  network: TonConnectNetwork,
): Buffer | null {
  const { code, data } = stateInit;
  if (!code || !data) return null;

  const networkGlobalId: number = network;

  try {
    const ds = data.beginParse();

    if (code.equals(codeV3R2)) {
      ds.loadUint(32);
      ds.loadUint(32);
      return Buffer.from(ds.loadBuffer(32));
    }

    if (code.equals(codeV4)) {
      ds.loadUint(32);
      ds.loadUint(32);
      const pk = Buffer.from(ds.loadBuffer(32));
      ds.loadBit();
      return pk;
    }

    if (code.equals(codeV5R1)) {
      ds.loadBit();
      ds.loadUint(32);
      loadWalletIdV5R1(ds, networkGlobalId);
      return Buffer.from(ds.loadBuffer(32));
    }
  } catch {
    return null;
  }

  return null;
}
