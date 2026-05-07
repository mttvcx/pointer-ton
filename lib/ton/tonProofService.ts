import 'server-only';
import { sha256 } from '@ton/crypto';
import { Address, Cell, contractAddress, loadStateInit } from '@ton/core';
import { sign } from 'tweetnacl';
import { Buffer } from 'buffer';
import type { TonConnectNetwork } from '@/lib/ton/tonLiteClient';

export interface TonProofBody {
  timestamp: number;
  domain: { lengthBytes: number; value: string };
  payload: string;
  signature: string;
  state_init: string;
}

export interface CheckTonProofInput {
  address: string;
  network: TonConnectNetwork;
  public_key: string;
  proof: TonProofBody;
  /** Original random payload sent in TonConnect `tonProof` request (before hashing). */
  payloadToken: string;
}

const tonProofPrefix = 'ton-proof-item-v2/';
const tonConnectPrefix = 'ton-connect';
const validAuthTime = 15 * 60;

function allowedDomains(): string[] {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? 'http://127.0.0.1:3001';
  try {
    const host = new URL(raw).host;
    const set = new Set<string>([
      host,
      'localhost:3001',
      '127.0.0.1:3001',
      'localhost:3000',
      '127.0.0.1:3000',
      'localhost:5173',
    ]);
    return [...set];
  } catch {
    return ['127.0.0.1:3001', 'localhost:3001'];
  }
}

/**
 * Verify TonConnect address ownership per TonConnect ton_proof spec.
 * @see https://docs.ton.org/v3/guidelines/ton-connect/verifying-signed-in-users
 */
export async function verifyTonConnectProof(
  body: CheckTonProofInput,
  getWalletPublicKey: (address: string) => Promise<Buffer>,
): Promise<boolean> {
  try {
    const stateInit = loadStateInit(Cell.fromBase64(body.proof.state_init).beginParse());

    const publicKey = await getWalletPublicKey(body.address);
    const wantedPublicKey = Buffer.from(body.public_key, 'hex');
    if (!publicKey.equals(wantedPublicKey)) {
      return false;
    }

    const wantedAddress = Address.parse(body.address);
    const address = contractAddress(wantedAddress.workChain, stateInit);
    if (!address.equals(wantedAddress)) {
      return false;
    }

    if (!allowedDomains().includes(body.proof.domain.value)) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - validAuthTime > body.proof.timestamp) {
      return false;
    }

    const msgHashExpected = Buffer.from(await sha256(Buffer.from(body.payloadToken))).toString('hex');
    if (body.proof.payload !== msgHashExpected) {
      return false;
    }

    const wc = Buffer.alloc(4);
    wc.writeUInt32BE(address.workChain, 0);

    const ts = Buffer.alloc(8);
    ts.writeBigUInt64LE(BigInt(body.proof.timestamp), 0);

    const dl = Buffer.alloc(4);
    dl.writeUInt32LE(body.proof.domain.lengthBytes, 0);

    const msg = Buffer.concat([
      Buffer.from(tonProofPrefix),
      wc,
      Buffer.from(address.hash),
      dl,
      Buffer.from(body.proof.domain.value),
      ts,
      Buffer.from(body.proof.payload, 'utf8'),
    ]);

    const inner = Buffer.from(await sha256(msg));
    const fullMsg = Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from(tonConnectPrefix), inner]);
    const result = Buffer.from(await sha256(fullMsg));

    const signature = Buffer.from(body.proof.signature, 'base64');
    return sign.detached.verify(result, signature, publicKey);
  } catch {
    return false;
  }
}
