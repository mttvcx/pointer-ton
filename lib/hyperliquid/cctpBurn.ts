import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Connection,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { HYPEREVM_CCTP_DOMAIN } from '@/lib/hyperliquid/cctp';

/**
 * Solana CCTP V2 `depositForBurn` — burns native USDC on Solana to be minted to
 * the user's address on HyperEVM (Hyperliquid). Built to Circle's OFFICIAL spec
 * (program ids, the 16-account DepositForBurnContext order, PDA seeds, params,
 * Anchor discriminator) — not from memory.
 *
 * UNTESTED until a real transfer: the first $1 burn is the proof. The
 * loss-critical inputs (destination domain 19, mint recipient = the user's own
 * EVM address) are confirmed, so any remaining mistake fails the tx — it can't
 * misroute funds.
 */

export const CCTP_TOKEN_MESSENGER_MINTER = new PublicKey('CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe');
export const CCTP_MESSAGE_TRANSMITTER = new PublicKey('CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC');
export const SOLANA_USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

/** sha256("global:deposit_for_burn")[0..8] (computed, not guessed). */
const DEPOSIT_FOR_BURN_DISCRIMINATOR = Uint8Array.from([215, 60, 61, 46, 114, 55, 128, 176]);

function pda(seeds: (Buffer | Uint8Array)[], program: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, program)[0];
}

/** EVM `0x…` address → 32-byte CCTP mintRecipient (20 bytes, left-padded with 12 zeros). */
export function evmAddressToMintRecipient(evmAddress: string): Buffer {
  const hex = evmAddress.replace(/^0x/, '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(hex)) throw new Error('invalid_evm_address');
  const buf = Buffer.alloc(32);
  Buffer.from(hex, 'hex').copy(buf, 12);
  return buf;
}

function encodeDepositForBurnData(
  amount: bigint,
  destinationDomain: number,
  mintRecipient: Buffer,
  maxFee: bigint,
  minFinalityThreshold: number,
): Buffer {
  // disc(8) + amount(u64) + domain(u32) + recipient(32) + caller(32) + maxFee(u64) + minFinality(u32)
  const b = Buffer.alloc(8 + 8 + 4 + 32 + 32 + 8 + 4);
  let o = 0;
  Buffer.from(DEPOSIT_FOR_BURN_DISCRIMINATOR).copy(b, o); o += 8;
  b.writeBigUInt64LE(amount, o); o += 8;
  b.writeUInt32LE(destinationDomain, o); o += 4;
  mintRecipient.copy(b, o); o += 32;
  // destination_caller = 32 zero bytes → any caller may complete the mint
  o += 32;
  b.writeBigUInt64LE(maxFee, o); o += 8;
  b.writeUInt32LE(minFinalityThreshold, o); o += 4;
  return b;
}

export function buildDepositForBurnIx(params: {
  owner: PublicKey;
  amount: bigint;
  destinationDomain: number;
  mintRecipient: Buffer;
  messageSentEventData: PublicKey;
  maxFee?: bigint;
  minFinalityThreshold?: number;
}): TransactionInstruction {
  const { owner, amount, destinationDomain, mintRecipient, messageSentEventData } = params;
  const usdc = SOLANA_USDC_MINT;
  const TMM = CCTP_TOKEN_MESSENGER_MINTER;
  const MT = CCTP_MESSAGE_TRANSMITTER;

  const burnTokenAccount = getAssociatedTokenAddressSync(usdc, owner, true);
  const senderAuthority = pda([Buffer.from('sender_authority')], TMM);
  const denylist = pda([Buffer.from('denylist_account'), owner.toBuffer()], TMM);
  const messageTransmitter = pda([Buffer.from('message_transmitter')], MT);
  const tokenMessenger = pda([Buffer.from('token_messenger')], TMM);
  const remoteTokenMessenger = pda([Buffer.from('remote_token_messenger'), Buffer.from(String(destinationDomain))], TMM);
  const tokenMinter = pda([Buffer.from('token_minter')], TMM);
  const localToken = pda([Buffer.from('local_token'), usdc.toBuffer()], TMM);

  // Order MUST match Circle's DepositForBurnContext exactly.
  const keys = [
    { pubkey: owner, isSigner: true, isWritable: false },
    { pubkey: owner, isSigner: true, isWritable: true }, // event_rent_payer
    { pubkey: senderAuthority, isSigner: false, isWritable: false },
    { pubkey: burnTokenAccount, isSigner: false, isWritable: true },
    { pubkey: denylist, isSigner: false, isWritable: false },
    { pubkey: messageTransmitter, isSigner: false, isWritable: true },
    { pubkey: tokenMessenger, isSigner: false, isWritable: false },
    { pubkey: remoteTokenMessenger, isSigner: false, isWritable: false },
    { pubkey: tokenMinter, isSigner: false, isWritable: false },
    { pubkey: localToken, isSigner: false, isWritable: true },
    { pubkey: usdc, isSigner: false, isWritable: true },
    { pubkey: messageSentEventData, isSigner: true, isWritable: true },
    { pubkey: MT, isSigner: false, isWritable: false },
    { pubkey: TMM, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const data = encodeDepositForBurnData(
    amount,
    destinationDomain,
    mintRecipient,
    params.maxFee ?? 0n,
    // 2000 = finalized/standard (free). Lower enables Fast Transfer (paid).
    params.minFinalityThreshold ?? 2000,
  );

  return new TransactionInstruction({ programId: TMM, keys, data });
}

/**
 * Assemble the full Solana funding transaction: SOL→HyperEVM USDC via CCTP. The
 * caller has the user's Privy Solana wallet sign as `owner` and submits it; the
 * returned `eventKeypair` is already partial-signed in. Burn tx signature feeds
 * `/api/perps/cctp/attestation` to track the mint.
 */
export async function buildCctpDepositTx(opts: {
  connection: Connection;
  owner: PublicKey;
  amountUsdc: number;
  evmRecipient: string;
  destinationDomain?: number;
}): Promise<{ transaction: Transaction; eventKeypair: Keypair }> {
  const amount = BigInt(Math.round(opts.amountUsdc * 1_000_000));
  if (amount <= 0n) throw new Error('amount_must_be_positive');
  const mintRecipient = evmAddressToMintRecipient(opts.evmRecipient);
  const eventKeypair = Keypair.generate();

  const ix = buildDepositForBurnIx({
    owner: opts.owner,
    amount,
    destinationDomain: opts.destinationDomain ?? HYPEREVM_CCTP_DOMAIN,
    mintRecipient,
    messageSentEventData: eventKeypair.publicKey,
  });

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));
  tx.add(ix);
  tx.feePayer = opts.owner;
  const { blockhash } = await opts.connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.partialSign(eventKeypair);

  return { transaction: tx, eventKeypair };
}
