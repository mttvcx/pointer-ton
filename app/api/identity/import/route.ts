import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { authorizeAdminRequest } from '@/lib/admin/authorize';
import { importIdentitySeeds, detectDuplicates, listRegistryStats } from '@/lib/identity/identityService';
import { parseManualJsonImport } from '@/lib/identity/providers/manualImport';
import { parseKolscanExport } from '@/lib/identity/providers/kolscan';
import { parseGmgnExport } from '@/lib/identity/providers/gmgn';
import { isAppChainId, type AppChainId } from '@/lib/chains/appChain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    format: z.enum(['seed', 'kolscan', 'gmgn', 'manual_json']).default('seed'),
    chain: z.string().optional(),
    rows: z.unknown().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const founderWallet = req.headers.get('x-founder-wallet');
  if (!authorizeAdminRequest(req, founderWallet)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  let rows = parseManualJsonImport(body.rows);
  if (body.format === 'kolscan') rows = parseKolscanExport(body.rows);
  if (body.format === 'gmgn') {
    const chain = body.chain && isAppChainId(body.chain) ? body.chain : ('eth' as AppChainId);
    rows = parseGmgnExport(body.rows, chain);
  }

  const result = importIdentitySeeds(rows);
  return NextResponse.json({
    ok: true,
    ...result,
    stats: listRegistryStats(),
    duplicates: detectDuplicates(),
  });
}

export async function GET(req: NextRequest) {
  const founderWallet = req.headers.get('x-founder-wallet');
  if (!authorizeAdminRequest(req, founderWallet)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    stats: listRegistryStats(),
    duplicates: detectDuplicates(),
  });
}
