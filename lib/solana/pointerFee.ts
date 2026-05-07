import 'server-only';

import { createHash } from 'node:crypto';
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { isValidPublicKey } from '@/lib/utils/addresses';

/** Template id from `anchor/Anchor.toml` — replace after `anchor keys sync`. */
export const POINTER_FEE_TEMPLATE_PROGRAM_ID =
  'GGKwHCsxMsVRCZEqtgmTZMBp18h9DVpGDERykhHrT2BJ';

export const POINTER_FEE_STATE_SEED = 'fee_state' as const;

function ixDiscriminator(name: string): Buffer {
  return createHash('sha256').update(Buffer.from(`global:${name}`)).digest().subarray(0, 8);
}

function u64LE(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

/**
 * Active program id: `POINTER_FEE_PROGRAM_ID` or
 * `NEXT_PUBLIC_POINTER_FEE_PROGRAM_ID`, else the template devnet id.
 */
export function getPointerFeeProgramId(): PublicKey {
  const raw =
    process.env.POINTER_FEE_PROGRAM_ID?.trim() ||
    process.env.NEXT_PUBLIC_POINTER_FEE_PROGRAM_ID?.trim() ||
    POINTER_FEE_TEMPLATE_PROGRAM_ID;
  if (!isValidPublicKey(raw)) {
    throw new Error('POINTER_FEE_PROGRAM_ID is not a valid public key');
  }
  return new PublicKey(raw);
}

export function pointerFeeStatePda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from(POINTER_FEE_STATE_SEED)], programId);
}

export function createPointerFeeInitializeIx(input: {
  programId: PublicKey;
  authority: PublicKey;
  treasury: PublicKey;
}): TransactionInstruction {
  const [feeState] = pointerFeeStatePda(input.programId);
  const data = Buffer.concat([ixDiscriminator('initialize'), input.treasury.toBuffer()]);
  return new TransactionInstruction({
    programId: input.programId,
    keys: [
      { pubkey: input.authority, isSigner: true, isWritable: true },
      { pubkey: feeState, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createPointerFeePayFeeIx(input: {
  programId: PublicKey;
  user: PublicKey;
  lamports: bigint;
}): TransactionInstruction {
  const [feeState] = pointerFeeStatePda(input.programId);
  const data = Buffer.concat([ixDiscriminator('pay_fee'), u64LE(input.lamports)]);
  return new TransactionInstruction({
    programId: input.programId,
    keys: [
      { pubkey: input.user, isSigner: true, isWritable: true },
      { pubkey: feeState, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createPointerFeeWithdrawIx(input: {
  programId: PublicKey;
  authority: PublicKey;
  treasury: PublicKey;
  lamports: bigint;
}): TransactionInstruction {
  const [feeState] = pointerFeeStatePda(input.programId);
  const data = Buffer.concat([ixDiscriminator('withdraw'), u64LE(input.lamports)]);
  return new TransactionInstruction({
    programId: input.programId,
    keys: [
      { pubkey: input.authority, isSigner: true, isWritable: true },
      { pubkey: feeState, isSigner: false, isWritable: true },
      { pubkey: input.treasury, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createPointerFeeSetTreasuryIx(input: {
  programId: PublicKey;
  authority: PublicKey;
  newTreasury: PublicKey;
}): TransactionInstruction {
  const [feeState] = pointerFeeStatePda(input.programId);
  const data = Buffer.concat([ixDiscriminator('set_treasury'), input.newTreasury.toBuffer()]);
  return new TransactionInstruction({
    programId: input.programId,
    keys: [
      { pubkey: input.authority, isSigner: true, isWritable: true },
      { pubkey: feeState, isSigner: false, isWritable: true },
    ],
    data,
  });
}
