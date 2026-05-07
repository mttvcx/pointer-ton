import 'server-only';
import { Address, TonClient4 } from '@ton/ton';
import { Buffer } from 'buffer';

export type TonConnectNetwork = -239 | -3;

export function tonLiteClient(network: TonConnectNetwork): TonClient4 {
  const endpoint =
    network === -239
      ? 'https://mainnet-v4.tonhubapi.com'
      : 'https://testnet-v4.tonhubapi.com';
  return new TonClient4({ endpoint });
}

export async function fetchWalletPublicKey(
  address: string,
  network: TonConnectNetwork,
): Promise<Buffer> {
  const client = tonLiteClient(network);
  const master = await client.getLastBlock();
  const result = await client.runMethod(master.last.seqno, Address.parse(address), 'get_public_key', []);
  const pk = result.reader.readBigNumber().toString(16).padStart(64, '0');
  return Buffer.from(pk, 'hex');
}
