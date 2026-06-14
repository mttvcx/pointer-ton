import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import type { PublicKey } from '@solana/web3.js';

/** Resolve SPL token program from mint account owner (Token vs Token-2022). */
export function tokenProgramFromMintOwner(owner: PublicKey): PublicKey {
  return owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}
