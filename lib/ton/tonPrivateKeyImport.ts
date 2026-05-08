/**
 * Client-safe helpers: derive a standard v4 TON wallet address from a user-supplied secret.
 * Never send the raw secret to the server — only the derived address is POSTed to /api/wallets/create.
 */
import {
  keyPairFromSeed,
  keyPairFromSecretKey,
  mnemonicToPrivateKey,
  mnemonicValidate,
} from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

function walletV4Address(publicKey: Buffer): string {
  const w = WalletContractV4.create({ workchain: 0, publicKey });
  const raw = w.address.toString({ bounceable: true, urlSafe: true });
  const n = normalizeTonAddress(raw);
  if (!n) throw new Error('derived_invalid_address');
  return n;
}

/**
 * Accepts:
 * - 24-word (or 12/18) TON mnemonic, space-separated
 * - 64-character hex = 32-byte Ed25519 seed
 * - 128-character hex = 64-byte NaCl secret key
 */
export async function importTonPrivateKeyToAddress(trimmed: string): Promise<string> {
  const t = trimmed.trim();
  if (!t) throw new Error('empty_key');

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 12) {
    const ok = await mnemonicValidate(words);
    if (!ok) throw new Error('invalid_mnemonic');
    const kp = await mnemonicToPrivateKey(words);
    return walletV4Address(Buffer.from(kp.publicKey));
  }

  const hex = t.replace(/^0x/i, '');
  if (/^[0-9a-fA-F]+$/.test(hex)) {
    if (hex.length === 64) {
      const seed = Buffer.from(hex, 'hex');
      if (seed.length !== 32) throw new Error('invalid_hex_seed');
      const kp = keyPairFromSeed(seed);
      return walletV4Address(Buffer.from(kp.publicKey));
    }
    if (hex.length === 128) {
      const sk = Buffer.from(hex, 'hex');
      const kp = keyPairFromSecretKey(sk);
      return walletV4Address(Buffer.from(kp.publicKey));
    }
  }

  throw new Error('unsupported_key_format');
}
