import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { upsertUserFromPrivy } from '@/lib/db/users';
import { signPointerSession } from '@/lib/auth/pointerSession';
import { verifyTonConnectProof } from '@/lib/ton/tonProofService';
import { fetchWalletPublicKey, type TonConnectNetwork } from '@/lib/ton/tonLiteClient';
import { assertTonAddress, tonAuthSubject } from '@/lib/utils/tonAddress';
import { isValidPublicKey } from '@/lib/utils/addresses';
import { verifyPrivyJwksOnly, fetchVerifiedPrivyEmail } from '@/lib/privy/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Privy `POST /api/auth/sync` — same shape as `pointer` repo. */
const PrivySyncBodySchema = z
  .object({
    walletAddress: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v && isValidPublicKey(v) ? v : null)),
    // SECURITY: accepted for backward-compat but IGNORED. The stored email is
    // read server-side from Privy's verified identity (see below) — trusting the
    // client email here let any user self-escalate to superadmin via
    // ADMIN_BOOTSTRAP_EMAILS.
    email: z.string().trim().email().optional().nullable(),
    username: z.string().trim().min(1).max(64).optional().nullable(),
  })
  .strict();

/** TonConnect `CHAIN` uses string ids (`"-239"` mainnet, `"-3"` testnet); coerce for Zod. */
const NetworkSchema = z
  .union([z.string(), z.number()])
  .transform((v): TonConnectNetwork => {
    const n = typeof v === 'string' ? Number(v) : v;
    if (n === -239 || n === -3) return n as TonConnectNetwork;
    throw new Error(`unsupported_network:${String(v)}`);
  });

const TonSyncBodySchema = z
  .object({
    address: z.string().trim().min(1),
    network: NetworkSchema,
    public_key: z.string().trim().min(1),
    payloadToken: z.string().trim().min(1),
    proof: z
      .object({
        timestamp: z.coerce.number().int(),
        domain: z.object({
          lengthBytes: z.coerce.number().int(),
          value: z.string(),
        }),
        payload: z.string(),
        signature: z.string(),
        state_init: z.string(),
      })
      .strict(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null;

  /** Branch A: Privy access token — sync user row (embedded wallets, profile). */
  if (bearer) {
    let verified;
    try {
      verified = await verifyPrivyJwksOnly(bearer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'invalid token';
      return NextResponse.json({ error: 'invalid_token', message }, { status: 401 });
    }

    let body: z.infer<typeof PrivySyncBodySchema>;
    try {
      const json: unknown = await req.json().catch(() => ({}));
      body = PrivySyncBodySchema.parse(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'bad request';
      return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
    }

    try {
      // The email is read from Privy's verified identity, NOT `body.email`.
      // (BLOCKER-1 fix: a client-supplied email matching ADMIN_BOOTSTRAP_EMAILS
      // would otherwise bootstrap the caller as superadmin.) null → leave the
      // stored email unchanged.
      const verifiedEmail = await fetchVerifiedPrivyEmail(verified.privyId);
      const user = await upsertUserFromPrivy({
        privyId: verified.privyId,
        walletAddress: body.walletAddress,
        email: verifiedEmail,
        username: body.username,
      });

      try {
        const { maybeAwardDailyLogin } = await import('@/lib/points/award');
        await maybeAwardDailyLogin(user.id);
      } catch (e) {
        console.warn('[/api/auth/sync] daily login points:', e instanceof Error ? e.message : e);
      }

      return NextResponse.json(
        {
          user: {
            id: user.id,
            privyId: user.privy_id,
            walletAddress: user.wallet_address,
            email: user.email,
            username: user.username,
            tierId: user.tier_id,
            createdAt: user.created_at,
          },
        },
        { status: 200 },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      console.error('[/api/auth/sync] Privy upsert failed:', message);
      return NextResponse.json({ error: 'sync_failed', message }, { status: 500 });
    }
  }

  /** Branch B: TonConnect proof — legacy session JWT for TON signing. */
  let body: z.infer<typeof TonSyncBodySchema>;
  try {
    const json: unknown = await req.json();
    body = TonSyncBodySchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'bad request';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  const canonical = (() => {
    try {
      return assertTonAddress(body.address);
    } catch {
      return null;
    }
  })();
  if (!canonical) {
    return NextResponse.json({ error: 'invalid_address', message: 'Invalid TON address' }, { status: 400 });
  }

  const checkInput = {
    address: body.address,
    network: body.network as TonConnectNetwork,
    public_key: body.public_key,
    payloadToken: body.payloadToken,
    proof: {
      ...body.proof,
      state_init: body.proof.state_init,
    },
  };

  const okProof = await verifyTonConnectProof(checkInput, (addr) =>
    fetchWalletPublicKey(addr, body.network as TonConnectNetwork),
  );
  if (!okProof) {
    return NextResponse.json(
      { error: 'invalid_proof', message: 'TonConnect proof verification failed' },
      { status: 401 },
    );
  }

  const authSubject = tonAuthSubject(canonical);

  try {
    const user = await upsertUserFromPrivy({
      privyId: authSubject,
      walletAddress: canonical,
      email: null,
      username: null,
    });

    const accessToken = await signPointerSession(authSubject, canonical);

    try {
      const { maybeAwardDailyLogin } = await import('@/lib/points/award');
      await maybeAwardDailyLogin(user.id);
    } catch (e) {
      console.warn('[/api/auth/sync] daily login points:', e instanceof Error ? e.message : e);
    }

    return NextResponse.json(
      {
        accessToken,
        user: {
          id: user.id,
          privyId: user.privy_id,
          walletAddress: user.wallet_address,
          email: user.email,
          username: user.username,
          tierId: user.tier_id,
          createdAt: user.created_at,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[/api/auth/sync] TonConnect upsert failed:', message);
    return NextResponse.json({ error: 'sync_failed', message }, { status: 500 });
  }
}
