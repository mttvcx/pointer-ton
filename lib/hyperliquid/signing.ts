import { encode as msgpackEncode } from '@msgpack/msgpack';
import { hexToBytes, keccak256, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Hyperliquid action signing — to spec (https://hyperliquid.gitbook.io signing docs).
 *
 * TWO schemes:
 *  1. L1 actions (order / cancel / updateLeverage): hash the msgpack-encoded
 *     action + nonce + vault flag, then EIP-712 sign the "phantom agent" with the
 *     AGENT key (chainId 1337, domain "Exchange"). No wallet prompt after approval.
 *  2. User-signed actions (approveAgent / withdraw): EIP-712 sign the action
 *     fields directly with the user's MAIN wallet (domain
 *     "HyperliquidSignTransaction", chainId = signatureChainId).
 *
 * NOTE: this is signing math only — it moves no funds. It MUST be validated with
 * a real funded test order before we trust it; the first live order is the proof.
 */

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as Hex;
/** Arbitrum One — the chain id HL user-signed actions are signed under for mainnet. */
export const HL_SIGNATURE_CHAIN_ID = '0xa4b1';

export type Signature = { r: Hex; s: Hex; v: number };

function nonceToBytes(nonce: number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(nonce), false); // 8-byte big-endian
  return b;
}

/** keccak256( msgpack(action) ++ nonce(8 BE) ++ vaultFlag ) — the HL L1 connectionId. */
export function actionHash(action: unknown, nonce: number, vaultAddress?: string | null): Hex {
  const actionBytes = msgpackEncode(action);
  const nonceBytes = nonceToBytes(nonce);
  const tail = vaultAddress ? hexToBytes(vaultAddress as Hex) : new Uint8Array(0);
  const data = new Uint8Array(actionBytes.length + 8 + 1 + tail.length);
  data.set(actionBytes, 0);
  data.set(nonceBytes, actionBytes.length);
  data[actionBytes.length + 8] = vaultAddress ? 0x01 : 0x00;
  if (tail.length) data.set(tail, actionBytes.length + 9);
  return keccak256(data);
}

function splitSig(sig: Hex): Signature {
  return {
    r: `0x${sig.slice(2, 66)}` as Hex,
    s: `0x${sig.slice(66, 130)}` as Hex,
    v: parseInt(sig.slice(130, 132), 16),
  };
}

/** Sign an L1 action (order/cancel/updateLeverage) with the AGENT private key. */
export async function signL1Action(
  agentPrivateKey: Hex,
  action: unknown,
  nonce: number,
  isMainnet = true,
): Promise<Signature> {
  const connectionId = actionHash(action, nonce, null);
  const account = privateKeyToAccount(agentPrivateKey);
  const sig = await account.signTypedData({
    domain: { name: 'Exchange', version: '1', chainId: 1337, verifyingContract: ZERO_ADDR },
    types: {
      Agent: [
        { name: 'source', type: 'string' },
        { name: 'connectionId', type: 'bytes32' },
      ],
    },
    primaryType: 'Agent',
    message: { source: isMainnet ? 'a' : 'b', connectionId },
  });
  return splitSig(sig);
}

/** EIP-712 typed data for `approveAgent` — signed by the user's MAIN wallet (Privy). */
export function approveAgentTypedData(
  agentAddress: Hex,
  agentName: string,
  nonce: number,
  isMainnet = true,
) {
  return {
    domain: {
      name: 'HyperliquidSignTransaction',
      version: '1',
      chainId: parseInt(HL_SIGNATURE_CHAIN_ID, 16),
      verifyingContract: ZERO_ADDR,
    },
    types: {
      'HyperliquidTransaction:ApproveAgent': [
        { name: 'hyperliquidChain', type: 'string' },
        { name: 'agentAddress', type: 'address' },
        { name: 'agentName', type: 'string' },
        { name: 'nonce', type: 'uint64' },
      ],
    },
    primaryType: 'HyperliquidTransaction:ApproveAgent' as const,
    message: {
      hyperliquidChain: isMainnet ? 'Mainnet' : 'Testnet',
      agentAddress,
      agentName,
      nonce,
    },
  };
}

/** The `approveAgent` action body posted to /exchange alongside the user signature. */
export function approveAgentAction(agentAddress: Hex, agentName: string, nonce: number, isMainnet = true) {
  return {
    type: 'approveAgent' as const,
    hyperliquidChain: isMainnet ? 'Mainnet' : 'Testnet',
    signatureChainId: HL_SIGNATURE_CHAIN_ID,
    agentAddress,
    agentName,
    nonce,
  };
}

export type OrderInput = {
  assetIndex: number;
  isBuy: boolean;
  priceWire: string;
  sizeWire: string;
  reduceOnly: boolean;
  tif: 'Ioc' | 'Gtc' | 'Alo';
};

/** Order action (key order matches the HL SDK so the msgpack hash is identical). */
export function buildOrderAction(o: OrderInput) {
  return {
    type: 'order' as const,
    orders: [
      { a: o.assetIndex, b: o.isBuy, p: o.priceWire, s: o.sizeWire, r: o.reduceOnly, t: { limit: { tif: o.tif } } },
    ],
    grouping: 'na' as const,
  };
}

export function buildUpdateLeverageAction(assetIndex: number, leverage: number, isCross = true) {
  return {
    type: 'updateLeverage' as const,
    asset: assetIndex,
    isCross,
    leverage: Math.max(1, Math.round(leverage)),
  };
}

/** Normalized decimal string (no trailing zeros / sci notation) — HL wire format. */
export function floatToWire(x: number): string {
  let s = x.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s;
}

/** Perps price: ≤5 significant figures AND ≤ (6 - szDecimals) decimal places. */
export function priceToWire(px: number, szDecimals: number): string {
  const maxDec = Math.max(0, 6 - szDecimals);
  const sig5 = Number(px.toPrecision(5));
  return floatToWire(Number(sig5.toFixed(maxDec)));
}

/** Perps size: rounded to the coin's szDecimals. */
export function sizeToWire(sz: number, szDecimals: number): string {
  return floatToWire(Number(sz.toFixed(szDecimals)));
}
