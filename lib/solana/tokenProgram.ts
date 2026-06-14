import 'server-only';

import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { Connection, PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/connection';
import { heliusCall, HELIUS_CREDITS } from '@/lib/helius/creditLogger';
import { tokenProgramFromMintOwner } from '@/lib/solana/tokenProgramId';

export { tokenProgramFromMintOwner } from '@/lib/solana/tokenProgramId';

/** Fetch mint account and return its token program id. */
export async function resolveMintTokenProgram(
  mint: PublicKey,
  connection: Connection = getConnection(),
): Promise<PublicKey> {
  const info = await heliusCall('getAccountInfo', HELIUS_CREDITS.RPC, () =>
    connection.getAccountInfo(mint),
  );
  if (!info) return TOKEN_PROGRAM_ID;
  return tokenProgramFromMintOwner(info.owner);
}
