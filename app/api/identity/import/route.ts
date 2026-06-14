import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { authorizeAdminRequest } from '@/lib/admin/authorize';
import { importIdentitySeedsPersisted, prepareIdentityRegistry } from '@/lib/identity/importPersisted';
import { detectDuplicates, listRegistryStats } from '@/lib/identity/identityService';
import { parseManualJsonImport, parseManualCsvImport } from '@/lib/identity/providers/manualImport';
import { parseKolscanExport } from '@/lib/identity/providers/kolscanParse';
import { importKolscanLeaderboardPaste } from '@/lib/identity/providers/kolscanParse';
import { importAxiomKolPaste } from '@/lib/identity/providers/axiomKolParse';
import { importKolLabelPaste } from '@/lib/identity/resolveKolLabelPaste';
import { parseGmgnExport } from '@/lib/identity/providers/gmgnParse';
import { parseAxiomTerminalExport } from '@/lib/identity/providers/axiomTerminal';
import { listSolanaRegistryAddresses, getKolscanPartialOverrides } from '@/lib/identity/registry';
import { expandSeedRowsToEvmChains } from '@/lib/identity/expandEvmChains';
import { isAppChainId, type AppChainId } from '@/lib/chains/appChain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    format: z
      .enum([
        'seed',
        'kolscan',
        'kolscan_paste',
        'axiom_kol_paste',
        'kol_label_paste',
        'gmgn',
        'manual_json',
        'csv',
        'axiom',
        'terminal',
      ])
      .default('seed'),
    chain: z.string().optional(),
    rows: z.unknown().optional(),
    /** Raw CSV text when format=csv */
    csv: z.string().optional(),
    /** Raw Kolscan / Axiom KOL paste when format=*_paste */
    text: z.string().optional(),
    /** partial → full address overrides for Kolscan/Axiom paste imports */
    addressOverrides: z.record(z.string(), z.string()).optional(),
    /** Extra resolution pool (merged with committed registry addresses) */
    knownAddresses: z.array(z.string()).optional(),
    /** When true, duplicate each EVM row to eth + bnb + base. */
    applyToEvmChains: z.boolean().optional(),
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
  let pasteReport: {
    resolved?: number;
    unresolved?: unknown[];
    kolscanParsed?: number;
    axiomParsed?: number;
  } | null = null;

  if (body.format === 'kolscan') rows = parseKolscanExport(body.rows);

  const pasteFormats = ['kolscan_paste', 'axiom_kol_paste', 'kol_label_paste'] as const;
  if (pasteFormats.includes(body.format as (typeof pasteFormats)[number])) {
    if (!body.text?.trim()) {
      return NextResponse.json({ error: 'missing_text' }, { status: 400 });
    }
    await prepareIdentityRegistry();
    const pool = [
      ...listSolanaRegistryAddresses(),
      ...(body.knownAddresses ?? []),
    ];
    const overrides = {
      ...getKolscanPartialOverrides(),
      ...(body.addressOverrides ?? {}),
    };

    if (body.format === 'kolscan_paste') {
      const result = importKolscanLeaderboardPaste(body.text, pool, overrides);
      rows = result.rows;
      pasteReport = {
        resolved: result.resolved,
        unresolved: result.unresolved,
        kolscanParsed: result.rows.length + result.unresolved.length,
      };
    } else if (body.format === 'axiom_kol_paste') {
      const result = importAxiomKolPaste(body.text, pool, overrides);
      rows = result.rows;
      pasteReport = {
        resolved: result.resolved,
        unresolved: result.unresolved,
        axiomParsed: result.rows.length + result.unresolved.length,
      };
    } else {
      const result = importKolLabelPaste(body.text, pool, overrides);
      rows = result.rows;
      pasteReport = {
        resolved: result.resolved,
        unresolved: result.unresolved,
        kolscanParsed: result.kolscanParsed,
        axiomParsed: result.axiomParsed,
      };
    }
  }

  if (body.format === 'gmgn') {
    const chain = body.chain && isAppChainId(body.chain) ? body.chain : ('eth' as AppChainId);
    rows = parseGmgnExport(body.rows, chain);
    if (body.applyToEvmChains) {
      rows = expandSeedRowsToEvmChains(rows);
    }
  }
  if (body.format === 'csv' && body.csv) rows = parseManualCsvImport(body.csv);
  if (body.format === 'axiom' || body.format === 'terminal') {
    const chain = body.chain && isAppChainId(body.chain) ? body.chain : ('sol' as AppChainId);
    rows = parseAxiomTerminalExport(body.rows, chain, body.format);
  }

  if (rows.length === 0) {
    if (pasteReport) {
      return NextResponse.json(
        {
          ok: false,
          error: 'no_resolved_rows',
          paste: pasteReport,
          stats: listRegistryStats(),
        },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: 'no_valid_rows' }, { status: 400 });
  }

  const result = await importIdentitySeedsPersisted(rows);
  return NextResponse.json({
    ok: true,
    ...result,
    paste: pasteReport,
    stats: listRegistryStats(),
    duplicates: detectDuplicates(),
  });
}

export async function GET(req: NextRequest) {
  const founderWallet = req.headers.get('x-founder-wallet');
  if (!authorizeAdminRequest(req, founderWallet)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  await prepareIdentityRegistry();
  return NextResponse.json({
    stats: listRegistryStats(),
    duplicates: detectDuplicates(),
  });
}
