import type { Json } from '@/lib/supabase/types';
import type { LaunchpadId } from '@/lib/utils/constants';
import {
  LAUNCHPAD_LABELS,
  LAUNCHPAD_PROGRAM_IDS,
  MIGRATION_PROGRAM_IDS,
} from '@/lib/utils/constants';
import { isValidPublicKey } from '@/lib/utils/addresses';
import { extractBondingProgressPct } from '@/lib/tokens/bondingProgress';
import type { Asset } from 'helius-sdk/types/das';

/**
 * Normalized launch / trade event extracted from an enhanced webhook tx or
 * from DAS `searchAssets` rows.
 */
export type LaunchpadEvent = {
  launchpad: LaunchpadId;
  mint: string;
  creator_wallet: string | null;
  symbol: string | null;
  name: string | null;
  image_url: string | null;
  /** Best-effort SOL liquidity at detection time. */
  initial_liquidity_sol: number | null;
  /** Bonding curve fill % (0–100) when present in tx metadata. */
  bonding_progress: number | null;
  raw: Json;
};

const WSOL_MINT = 'So11111111111111111111111111111111111111112';

const PROGRAM_TO_PAD: Record<string, LaunchpadId> = {
  [LAUNCHPAD_PROGRAM_IDS.pumpFun]: 'pump.fun',
  [LAUNCHPAD_PROGRAM_IDS.bags]: 'bags',
  [LAUNCHPAD_PROGRAM_IDS.printr]: 'printr',
  [LAUNCHPAD_PROGRAM_IDS.moonshot]: 'moonshot',
  [LAUNCHPAD_PROGRAM_IDS.bonk]: 'bonk',
  [LAUNCHPAD_PROGRAM_IDS.heaven]: 'heaven',
  [LAUNCHPAD_PROGRAM_IDS.believeDbc]: 'dynamic-bc',
};

const KNOWN_NON_MINTS = new Set<string>([
  ...Object.values(LAUNCHPAD_PROGRAM_IDS),
  ...Object.values(MIGRATION_PROGRAM_IDS),
  'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ',
  'TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM',
  WSOL_MINT,
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  '11111111111111111111111111111111',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
]);

function firstImageUrl(asset: Asset): string | null {
  const links = asset.content?.links?.image;
  if (links) return links;
  const file = asset.content?.files?.find((f) => f.cdn_uri || f.uri);
  return file?.cdn_uri ?? file?.uri ?? null;
}

function inferLaunchpadFromUri(jsonUri: string | undefined): LaunchpadId {
  const u = (jsonUri ?? '').toLowerCase();
  if (u.includes('pump')) return 'pump.fun';
  if (u.includes('bonk') || u.includes('letsbonk') || u.includes('launchlab')) return 'bonk';
  if (u.includes('bags')) return 'bags';
  if (u.includes('printr') || u.includes('print')) return 'printr';
  if (u.includes('moon.it') || u.includes('moonit')) return 'moonshot';
  if (u.includes('moonshot')) return 'moonshot';
  if (u.includes('heaven')) return 'heaven';
  if (u.includes('believe') || u.includes('launchcoin')) return 'dynamic-bc';
  if (u.includes('meteora') && (u.includes('dbc') || u.includes('dynamic'))) return 'dynamic-bc';
  return 'unknown';
}

/** Map a Helius DAS `Asset` into a `LaunchpadEvent` for DB upsert. */
export function launchpadEventFromDasAsset(asset: Asset): LaunchpadEvent | null {
  if (!asset?.id || !isValidPublicKey(asset.id)) return null;
  const md = asset.content?.metadata;
  const jsonUri = asset.content?.json_uri;
  const creator =
    asset.creators?.find((c) => c.verified)?.address ?? asset.creators?.[0]?.address ?? null;

  return {
    launchpad: inferLaunchpadFromUri(jsonUri),
    mint: asset.id,
    creator_wallet: creator,
    symbol: md?.symbol ?? null,
    name: md?.name ?? null,
    image_url: firstImageUrl(asset),
    initial_liquidity_sol: null,
    bonding_progress: extractBondingProgressPct(asset),
    raw: JSON.parse(JSON.stringify(asset)) as Json,
  };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function walkStrings(obj: unknown, out: Set<string>): void {
  if (obj == null) return;
  if (typeof obj === 'string') {
    if (isValidPublicKey(obj)) out.add(obj);
    return;
  }
  if (Array.isArray(obj)) {
    for (const x of obj) walkStrings(x, out);
    return;
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj as Record<string, unknown>)) walkStrings(v, out);
  }
}

/** Find program id keys inside an opaque enhanced-tx blob. */
function detectLaunchpadProgram(data: Record<string, unknown>): LaunchpadId | null {
  const candidates: unknown[] = [
    data['programId'],
    data['programID'],
    data['program_id'],
  ];
  const instr = data['instructions'];
  if (Array.isArray(instr)) {
    for (const ix of instr) {
      const r = asRecord(ix);
      if (!r) continue;
      candidates.push(r.programId, r.program_id, r.programID);
    }
  }
  const inner = data['transaction'];
  const tr = asRecord(inner);
  const msg = tr && asRecord(tr['message'] as unknown);
  const msgIx = msg && msg['instructions'];
  if (Array.isArray(msgIx)) {
    for (const ix of msgIx) {
      const r = asRecord(ix);
      if (!r) continue;
      candidates.push(r.programId, r.program_id, r.programID);
    }
  }
  for (const c of candidates) {
    if (typeof c === 'string' && PROGRAM_TO_PAD[c]) return PROGRAM_TO_PAD[c];
  }
  return null;
}

function pickMintFromTx(root: Record<string, unknown>, feePayer: string | null): string | null {
  const tokenTransfers = root.tokenTransfers;
  if (Array.isArray(tokenTransfers)) {
    for (const tt of tokenTransfers) {
      const r = asRecord(tt);
      const mint = typeof r?.mint === 'string' ? r.mint : null;
      if (mint && isValidPublicKey(mint) && mint !== WSOL_MINT && !KNOWN_NON_MINTS.has(mint)) {
        return mint;
      }
    }
  }

  const mintCandidates = new Set<string>();
  walkStrings(root, mintCandidates);
  for (const id of mintCandidates) {
    if (id === feePayer) continue;
    if (KNOWN_NON_MINTS.has(id)) continue;
    if (id === WSOL_MINT) continue;
    return id;
  }
  return null;
}

/**
 * Best-effort parse of a single Helius *enhanced* webhook transaction object.
 */
export function parseEnhancedTransaction(tx: unknown): LaunchpadEvent | null {
  const root = asRecord(tx);
  if (!root) return null;

  const pad = detectLaunchpadProgram(root);
  const feePayer = typeof root.feePayer === 'string' ? root.feePayer : null;
  const mint = pickMintFromTx(root, feePayer);
  if (!mint) return null;

  const tokenTransfers = root.tokenTransfers;
  let symbol: string | null = null;
  let name: string | null = null;
  if (Array.isArray(tokenTransfers)) {
    for (const tt of tokenTransfers) {
      const row = asRecord(tt);
      if (row?.mint !== mint) continue;
      symbol = typeof row.symbol === 'string' ? row.symbol : symbol;
      name = typeof row.name === 'string' ? row.name : name;
    }
    if (!symbol && tokenTransfers[0]) {
      const tt = asRecord(tokenTransfers[0]);
      symbol = typeof tt?.symbol === 'string' ? tt.symbol : null;
      name = typeof tt?.name === 'string' ? tt.name : null;
    }
  }

  const bonding_progress = extractBondingProgressPct(tx);

  return {
    launchpad: pad ?? 'unknown',
    mint,
    creator_wallet: feePayer,
    symbol,
    name,
    image_url: null,
    initial_liquidity_sol: null,
    bonding_progress,
    raw: JSON.parse(JSON.stringify(tx)) as Json,
  };
}

export function launchpadLabel(pad: LaunchpadId): string {
  return LAUNCHPAD_LABELS[pad];
}
