import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { createAdminSupabase } from '@/lib/supabase/server';
import { insertTrade } from '@/lib/db/trades';
import { awardPoints } from '@/lib/points/award';
import { isCrossmintConfigured, verifyCrossmintWebhook, parseCrossmintBuy } from '@/lib/crossmint/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Resolve a recipient wallet to a Pointer user (primary or linked wallet). */
async function resolveUserId(wallet: string): Promise<string | null> {
  const supabase = createAdminSupabase();
  const primary = await supabase.from('users').select('id').eq('wallet_address', wallet).maybeSingle();
  if (primary.data?.id) return primary.data.id as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linked = await (supabase as any).from('user_wallets').select('user_id').eq('wallet_address', wallet).maybeSingle();
  return (linked.data?.user_id as string) ?? null;
}

/**
 * Crossmint buy webhook: when an Apple Pay token purchase completes, record it as
 * a buy so it shows in holdings / cost-basis and earns points. Solana-only in v1
 * (the trades table is Solana-centric; other chains are acknowledged but not
 * recorded yet). Never trusts the payload without a valid Svix signature.
 */
export async function POST(req: NextRequest) {
  if (!isCrossmintConfigured()) {
    return NextResponse.json({ configured: false }, { status: 200 });
  }

  const rawBody = await req.text();
  const ok = verifyCrossmintWebhook(rawBody, {
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
  });
  if (!ok) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const buy = parseCrossmintBuy(event);
  if (!buy) return NextResponse.json({ ok: true, recorded: false, reason: 'not_a_completed_buy' });

  // v1: Solana only. Validate the mint is a real Solana pubkey.
  let mintCanon: string;
  try {
    mintCanon = new PublicKey(buy.mint.trim()).toBase58();
  } catch {
    console.log('[crossmint/webhook] non-solana or bad mint, acknowledged not recorded', { chain: buy.chain, orderId: buy.orderId });
    return NextResponse.json({ ok: true, recorded: false, reason: 'non_solana' });
  }

  if (!buy.recipientWallet) {
    console.log('[crossmint/webhook] no recipient wallet in event', { orderId: buy.orderId });
    return NextResponse.json({ ok: true, recorded: false, reason: 'no_recipient' });
  }

  const userId = await resolveUserId(buy.recipientWallet.trim());
  if (!userId) {
    console.log('[crossmint/webhook] recipient not a Pointer user', { wallet: buy.recipientWallet, orderId: buy.orderId });
    return NextResponse.json({ ok: true, recorded: false, reason: 'unknown_recipient' });
  }

  // Stable, idempotent signature so a re-sent webhook doesn't double-record.
  const txSignature = `crossmint:${buy.orderId || randomUUID()}`;
  const amountInRaw = buy.amountUsd != null ? String(Math.round(buy.amountUsd * 1e6)) : '0'; // USDC (6dp)

  try {
    const trade = await insertTrade({
      id: randomUUID(),
      user_id: userId,
      mint: mintCanon,
      side: 'buy',
      amount_in_raw: amountInRaw,
      amount_out_raw: buy.amountOutRaw ?? '0',
      amount_sol: 0, // Crossmint buys are fiat→token; no SOL notional, no platform fee
      platform_fee_lamports: 0,
      tx_signature: txSignature,
      status: 'confirmed',
      submitted_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    });

    // No platform fee on a Crossmint buy → no cashback/referral. Points are
    // best-effort (dedupe by order so a resend is a no-op).
    try {
      await awardPoints(userId, 'trade_volume', {
        dedupeKey: `crossmint:${buy.orderId}`,
        amountSol: 0,
        metadata: { mint: mintCanon, side: 'buy', source: 'crossmint', orderId: buy.orderId },
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ ok: true, recorded: true, tradeId: trade.id });
  } catch (err) {
    // Likely a duplicate (unique tx_signature) on a resend — treat as success.
    const message = err instanceof Error ? err.message : 'insert_failed';
    if (/duplicate|unique/i.test(message)) {
      return NextResponse.json({ ok: true, recorded: false, reason: 'already_recorded' });
    }
    console.error('[crossmint/webhook] record failed', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
