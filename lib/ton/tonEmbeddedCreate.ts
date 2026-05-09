/**
 * Client-only: generate a standard v4 TON wallet + 24-word mnemonic.
 * Never send the mnemonic to the server — only register the address with is_imported: true.
 */
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

export type GeneratedEmbeddedTonWallet = {
  address: string;
  mnemonicWords: string[];
};

export async function generateEmbeddedTonWallet(): Promise<GeneratedEmbeddedTonWallet> {
  const mnemonicWords = await mnemonicNew(24);
  const kp = await mnemonicToPrivateKey(mnemonicWords);
  const w = WalletContractV4.create({ workchain: 0, publicKey: Buffer.from(kp.publicKey) });
  const raw = w.address.toString({ bounceable: true, urlSafe: true });
  const n = normalizeTonAddress(raw);
  if (!n) throw new Error('derived_invalid_address');
  return { address: n, mnemonicWords };
}
