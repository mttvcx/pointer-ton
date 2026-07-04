import 'server-only';

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type AddressLookupTableAccount,
} from '@solana/web3.js';
import { getConnection } from '@/lib/solana/connection';

/** Prepend idempotent ATA creation so Jupiter platform-fee accounts exist on first trade. */
export async function prependAtaCreationToVersionedSwap(
  swapTransactionBase64: string,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  // Defaults to classic SPL so SOL-leg fee ATAs are created exactly as before;
  // token-2022 fee mints (xStocks) pass TOKEN_2022_PROGRAM_ID for the right ATA.
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
): Promise<string> {
  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransactionBase64, 'base64'));
  const lookups = tx.message.addressTableLookups;

  let lookupAccounts: AddressLookupTableAccount[] = [];
  if (lookups.length > 0) {
    const connection = getConnection();
    for (const lookup of lookups) {
      const { value } = await connection.getAddressLookupTable(lookup.accountKey);
      if (!value) {
        throw new Error('swap_lookup_table_missing');
      }
      lookupAccounts.push(value);
    }
  }

  const decompiled = TransactionMessage.decompile(tx.message, {
    addressLookupTableAccounts: lookupAccounts,
  });

  const allowOwnerOffCurve = !PublicKey.isOnCurve(owner.toBytes());
  const ata = getAssociatedTokenAddressSync(
    mint,
    owner,
    allowOwnerOffCurve,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  decompiled.instructions.unshift(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      ata,
      owner,
      mint,
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  );

  const rebuilt = new VersionedTransaction(decompiled.compileToV0Message(lookupAccounts));
  return Buffer.from(rebuilt.serialize()).toString('base64');
}
