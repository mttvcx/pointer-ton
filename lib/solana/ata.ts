import 'server-only';

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import type { PublicKey, TransactionInstruction } from '@solana/web3.js';

/**
 * Idempotent ATA creation for SPL Token. Fee payer defaults to `owner` (typical
 * for user-signed swap txs).
 */
export function ensureAtaInstruction(owner: PublicKey, mint: PublicKey): TransactionInstruction {
  const ata = getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return createAssociatedTokenAccountIdempotentInstruction(
    owner,
    ata,
    owner,
    mint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}
