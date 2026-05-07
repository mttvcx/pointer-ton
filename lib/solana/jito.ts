import 'server-only';
import {
  SystemProgram,
  PublicKey,
  type TransactionInstruction,
} from '@solana/web3.js';

/**
 * Jito mainnet tip accounts (public list). One is chosen at random per
 * submission so load spreads across validators.
 *
 * @see https://docs.jito.wtf/lowlatencytxnsend/#tip-payment
 */
export const JITO_MAINNET_TIP_ACCOUNTS: readonly string[] = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctiNZ8fAjKz9a',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBn7KDaVLp',
] as const;

export function pickRandomJitoTipAccount(): string {
  const i = Math.floor(Math.random() * JITO_MAINNET_TIP_ACCOUNTS.length);
  return JITO_MAINNET_TIP_ACCOUNTS[i]!;
}

export function getTipInstruction(payer: PublicKey, lamports: number): TransactionInstruction {
  return SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: new PublicKey(pickRandomJitoTipAccount()),
    lamports,
  });
}
