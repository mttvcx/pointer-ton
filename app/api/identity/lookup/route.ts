import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { APP_CHAIN_IDS, isAppChainId } from '@/lib/chains/appChain';
import { resolveWalletIdentities } from '@/lib/identity/identityService';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getUserByPrivyId } from '@/lib/db/users';
import { getWalletLabelsForUser } from '@/lib/db/walletLabels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    chain: z.enum(APP_CHAIN_IDS as unknown as [typeof APP_CHAIN_IDS[number], ...typeof APP_CHAIN_IDS[number][]]),
    addresses: z.array(z.string().trim().min(8).max(128)).max(200),
  })
  .strict();

async function loadUserLabels(req: NextRequest): Promise<Record<string, string>> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return {};
  try {
    const verified = await verifyPrivyAccessToken(token);
    const user = await getUserByPrivyId(verified.privyId);
    if (!user) return {};
    const rows = await getWalletLabelsForUser(user.id);
    const out: Record<string, string> = {};
    for (const [addr, row] of Object.entries(rows)) {
      out[addr] = row.label;
    }
    return out;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  const userLabels = await loadUserLabels(req);

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!isAppChainId(body.chain)) {
    return NextResponse.json({ error: 'invalid_chain' }, { status: 400 });
  }

  const identities = resolveWalletIdentities({
    chain: body.chain,
    addresses: body.addresses,
    userLabels,
  });

  return NextResponse.json({ chain: body.chain, identities });
}
