import type { Json } from '@/lib/supabase/types';
import {
  MIGRATION_PROGRAM_IDS,
  MIGRATION_PROGRAM_TO_DEST,
  type MigrationDestination,
} from '@/lib/utils/constants';
import { isValidPublicKey } from '@/lib/utils/addresses';

const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const MIGRATION_PROGRAM_SET = new Set<string>(Object.values(MIGRATION_PROGRAM_IDS));

export type MigrationEvent = {
  mint: string;
  destination: MigrationDestination;
  raw: Json;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function collectProgramIds(root: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  const candidates: unknown[] = [
    root.programId,
    root.programID,
    root.program_id,
  ];
  const instr = root.instructions;
  if (Array.isArray(instr)) {
    for (const ix of instr) {
      const r = asRecord(ix);
      if (!r) continue;
      for (const k of ['programId', 'program_id', 'programID']) {
        const v = r[k];
        if (typeof v === 'string') out.add(v);
      }
    }
  }
  for (const c of candidates) {
    if (typeof c === 'string') out.add(c);
  }
  return out;
}

function isQuoteMint(mint: string): boolean {
  return mint === WSOL_MINT || mint === USDC_MINT;
}

/** Best-effort mint from migration tx token transfers / balance changes. */
function extractMintFromMigrationTx(root: Record<string, unknown>): string | null {
  const mints = new Set<string>();

  const tokenTransfers = root.tokenTransfers;
  if (Array.isArray(tokenTransfers)) {
    for (const tt of tokenTransfers) {
      const r = asRecord(tt);
      const mint = typeof r?.mint === 'string' ? r.mint : null;
      if (mint && isValidPublicKey(mint) && !isQuoteMint(mint)) mints.add(mint);
    }
  }

  const accountData = root.accountData;
  if (Array.isArray(accountData)) {
    for (const ad of accountData) {
      const r = asRecord(ad);
      const tbc = r?.tokenBalanceChanges;
      if (!Array.isArray(tbc)) continue;
      for (const ch of tbc) {
        const cr = asRecord(ch);
        const mint = typeof cr?.mint === 'string' ? cr.mint : null;
        if (mint && isValidPublicKey(mint) && !isQuoteMint(mint)) mints.add(mint);
      }
    }
  }

  if (mints.size === 1) return [...mints][0] ?? null;
  if (mints.size > 1) {
    for (const m of mints) return m;
  }
  return null;
}

/**
 * Detect Raydium / PumpSwap / Meteora pool-creation migrations in an enhanced
 * Helius webhook transaction.
 */
export function parseMigrationTransaction(tx: unknown): MigrationEvent | null {
  const root = asRecord(tx);
  if (!root) return null;

  const programIds = collectProgramIds(root);
  let destination: MigrationDestination | null = null;
  for (const pid of programIds) {
    const dest = MIGRATION_PROGRAM_TO_DEST[pid];
    if (dest) {
      destination = dest;
      break;
    }
  }
  if (!destination) return null;

  const mint = extractMintFromMigrationTx(root);
  if (!mint) return null;

  return {
    mint,
    destination,
    raw: JSON.parse(JSON.stringify(tx)) as Json,
  };
}

export function isMigrationProgramId(programId: string): boolean {
  return MIGRATION_PROGRAM_SET.has(programId);
}
