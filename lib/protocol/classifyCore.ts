import type { AppChainId } from '@/lib/chains/appChain';
import { inferMintKind } from '@/lib/chains/mintKind';
import {
  LAUNCH_PAD_TO_PROTOCOL_ID,
  migrationDexProtocol,
  protocolFamilyFor,
  solLaunchProtocolFromProgram,
} from '@/lib/protocol/registry';
import {
  canonicalProtocolFromDexscreenerId,
} from '@/lib/protocol/dexProtocolMap';
import type {
  CanonicalProtocolId,
  ClassificationSource,
  ClassifierInput,
  TokenClassification,
  TokenKind,
} from '@/lib/protocol/types';

const CONF = {
  PROGRAM: 0.97,
  DAS_AUTHORITY: 0.95,
  MIGRATION: 0.96,
  GECKO_DEX: 0.88,
  DEXSCREENER: 0.82,
  DAS_URI: 0.62,
  METADATA_KEYWORD: 0.55,
  LAUNCH_PAD: 0.55,
  TON_GENERIC: 0.7,
  EVM_GENERIC: 0.65,
  MAYHEM_STRUCTURED: 0.9,
} as const;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function inferChainId(mint: string, geckoNetwork?: 'eth' | 'bsc' | 'base' | null, launchPad?: string | null): AppChainId {
  if (geckoNetwork === 'eth') return 'eth';
  if (geckoNetwork === 'bsc') return 'bnb';
  if (geckoNetwork === 'base') return 'base';
  const pad = (launchPad ?? '').toLowerCase();
  if (pad === 'eth') return 'eth';
  if (pad === 'bsc') return 'bnb';
  if (pad === 'base') return 'base';
  if (pad === 'ton') return 'ton';
  const kind = inferMintKind(mint);
  if (kind === 'sol') return 'sol';
  if (kind === 'ton') return 'ton';
  if (kind === 'evm') return 'eth';
  return 'sol';
}

function boolish(v: unknown): boolean | null {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === 'number' && Number.isFinite(v)) return v !== 0;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (t === 'true' || t === '1' || t === 'yes') return true;
    if (t === 'false' || t === '0' || t === 'no') return false;
  }
  return null;
}

function hasStructuredMayhemFlag(raw: unknown): boolean {
  const walk = (obj: unknown, depth: number): boolean => {
    if (depth > 8 || obj == null) return false;
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
        const lk = key.toLowerCase();
        if ((lk === 'mayhemmode' || lk === 'mayhem_mode' || lk === 'is_mayhem' || lk === 'ismayhem') && boolish(val) === true) {
          return true;
        }
        if (walk(val, depth + 1)) return true;
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        if (walk(item, depth + 1)) return true;
      }
    }
    return false;
  };
  return walk(raw, 0);
}

function inferLaunchPadProtocol(launchPad: string | null | undefined): CanonicalProtocolId | null {
  if (!launchPad) return null;
  const p = launchPad.toLowerCase().trim();
  if (LAUNCH_PAD_TO_PROTOCOL_ID[p]) return LAUNCH_PAD_TO_PROTOCOL_ID[p];
  if (p.includes('pump')) return 'pump_fun';
  if (p.includes('bonk')) return 'bonk';
  if (p.includes('bags')) return 'bags';
  if (p.includes('printr')) return 'printr';
  if (p.includes('moonshot') || p.includes('moon.it')) return 'moonshot';
  if (p.includes('heaven')) return 'heaven';
  if (p.includes('dynamic') || p === 'dbc') return 'dynamic_bc';
  return null;
}

function inferUriProtocol(jsonUri: string | undefined): CanonicalProtocolId | null {
  const u = (jsonUri ?? '').toLowerCase();
  if (!u) return null;
  if (u.includes('pump')) return 'pump_fun';
  if (u.includes('bonk') || u.includes('letsbonk')) return 'bonk';
  if (u.includes('bags')) return 'bags';
  if (u.includes('printr')) return 'printr';
  if (u.includes('moon.it') || u.includes('moonit') || u.includes('moonshot')) return 'moonshot';
  if (u.includes('heaven')) return 'heaven';
  if (u.includes('believe') || u.includes('launchcoin')) return 'dynamic_bc';
  if (u.includes('meteora') && (u.includes('dbc') || u.includes('dynamic'))) return 'dynamic_bc';
  return null;
}

function inferKeywordProtocolFromText(text: string, strictSymbolName: boolean): CanonicalProtocolId | null {
  const t = text.toLowerCase();
  if (!t) return null;
  if (strictSymbolName) {
    const compact = t.replace(/[^a-z0-9]/g, '');
    if (compact === 'bonk') return 'bonk';
    if (compact.includes('letsbonk')) return 'bonk';
    if (compact.includes('pumpfun') || compact === 'pump') return 'pump_fun';
  }
  if (t.includes('letsbonk') || t.includes('launchlab')) return 'bonk';
  if (/\bbonk\b/.test(t)) return 'bonk';
  if (t.includes('pump.fun') || t.includes('pumpfun')) return 'pump_fun';
  if (/\bpump\b/.test(t) && !strictSymbolName) return 'pump_fun';
  if (t.includes('bags.fm') || /\bbags\b/.test(t)) return 'bags';
  if (t.includes('printr')) return 'printr';
  if (t.includes('moon.it') || t.includes('moonit') || t.includes('moonshot')) return 'moonshot';
  if (t.includes('heaven')) return 'heaven';
  if (t.includes('believe') || t.includes('launchcoin')) return 'dynamic_bc';
  if (t.includes('meteora') && (t.includes('dbc') || t.includes('dynamic'))) return 'dynamic_bc';
  return null;
}

function inferMetadataKeywordProtocol(raw: unknown): CanonicalProtocolId | null {
  const r = asRecord(raw);
  if (!r) return null;
  const content = asRecord(r.content);
  const md = asRecord(content?.metadata);
  const symbolNameBits = [md?.symbol, md?.name, r.symbol, r.name]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .join(' ');
  if (symbolNameBits) {
    const fromSn = inferKeywordProtocolFromText(symbolNameBits, true);
    if (fromSn) return fromSn;
  }
  try {
    const serialized = JSON.stringify(r).toLowerCase();
    return inferKeywordProtocolFromText(serialized, false);
  } catch {
    return null;
  }
}

function resolveUnknownClassificationSource(hint?: ClassificationSource): ClassificationSource {
  if (hint === 'helius_das_search' || hint === 'helius_das_hydrate') return hint;
  if (hint === 'backfill') return 'backfill';
  return 'unknown';
}

export function parseGeckoDexProtocol(pool: unknown, network: 'eth' | 'bsc' | 'base'): { protocol_id: CanonicalProtocolId; dex_id: string } | null {
  const row = asRecord(pool);
  if (!row) return null;
  const rel = asRecord(row.relationships);
  const dexRel = asRecord(rel?.dex);
  const dexData = asRecord(dexRel?.data);
  const dexIdRaw = typeof dexData?.id === 'string' ? dexData.id : '';
  const dexSlug = dexIdRaw.includes('_') ? dexIdRaw.split('_').slice(1).join('_') : dexIdRaw;
  const d = dexSlug.toLowerCase();
  if (d.includes('pancake')) return { protocol_id: 'pancakeswap', dex_id: d || 'pancakeswap' };
  if (d.includes('uniswap')) {
    if (d.includes('v4')) return { protocol_id: 'uniswap_v4', dex_id: d };
    if (d.includes('v3')) return { protocol_id: 'uniswap_v3', dex_id: d };
    if (d.includes('v2')) return { protocol_id: 'uniswap_v2', dex_id: d };
    return { protocol_id: 'uniswap', dex_id: d || 'uniswap' };
  }
  return null;
}

function genericEvmProtocol(network: 'eth' | 'bsc' | 'base'): CanonicalProtocolId {
  if (network === 'eth') return 'eth';
  if (network === 'bsc') return 'bsc';
  return 'base';
}

function migrationFields(input: ClassifierInput) {
  if (input.migrated_at) {
    const dex = migrationDexProtocol(input.migrated_to ?? null);
    return {
      migration_state: 'migrated' as const,
      token_kind: 'amm_pool' as TokenKind,
      dex_id: dex ?? (typeof input.migrated_to === 'string' ? input.migrated_to : null),
      launch_type: 'migrated' as const,
    };
  }
  if (input.bonding_progress != null && input.bonding_progress >= 99.5) {
    return { migration_state: 'pre_migration' as const, token_kind: 'graduated' as TokenKind, dex_id: null, launch_type: 'bonding_curve' as const };
  }
  return { migration_state: 'pre_migration' as const, token_kind: 'bonding_curve' as TokenKind, dex_id: null, launch_type: 'bonding_curve' as const };
}

function buildResult(partial: Partial<TokenClassification> & { classification_source: ClassificationSource; source_confidence: number }, input: ClassifierInput): TokenClassification {
  const chain_id = partial.chain_id ?? inferChainId(input.mint, input.gecko_network, input.launch_pad);
  const mig = migrationFields(input);
  const protocol_id = partial.protocol_id ?? null;
  return {
    protocol_id,
    protocol_family: partial.protocol_family ?? (protocol_id ? protocolFamilyFor(protocol_id) : null),
    chain_id,
    token_kind: partial.token_kind ?? mig.token_kind,
    launch_type: partial.launch_type ?? mig.launch_type,
    migration_state: partial.migration_state ?? mig.migration_state,
    dex_id: partial.dex_id ?? mig.dex_id,
    classification_source: partial.classification_source,
    source_confidence: partial.source_confidence,
  };
}

export function classifyTokenProtocol(input: ClassifierInput): TokenClassification {
  const chain_id = inferChainId(input.mint, input.gecko_network, input.launch_pad);

  // Bags launchpad — mints carry a "BAGS" vanity suffix (like pump.fun's "pump").
  // Bags builds ON TOP of Meteora DBC/DAMM (programs dbcij3…/cpamdp…), so the pool
  // and dex-id read as "meteora"; the suffix is the reliable launchpad signal and
  // must win over the AMM-based classification. https://docs.bags.fm/principles/program-ids
  if (chain_id === 'sol' && input.mint.toLowerCase().endsWith('bags')) {
    return buildResult(
      { protocol_id: 'bags', classification_source: 'helius_das_uri', source_confidence: CONF.DAS_URI },
      input,
    );
  }

  if (input.migrated_at) {
    const origin = inferLaunchPadProtocol(input.launch_pad);
    const dex = migrationDexProtocol(input.migrated_to ?? null);
    if (origin || input.migrated_to) {
      return buildResult({
        protocol_id: origin ?? 'pump_fun',
        token_kind: 'amm_pool',
        launch_type: 'migrated',
        migration_state: 'migrated',
        dex_id: dex ?? (typeof input.migrated_to === 'string' ? input.migrated_to : null),
        classification_source: 'migration_program',
        source_confidence: CONF.MIGRATION,
      }, input);
    }
  }

  const fromProgram = solLaunchProtocolFromProgram(input.solana_program_id ?? null);
  if (fromProgram) {
    let protocol_id: CanonicalProtocolId = fromProgram;
    let source: ClassificationSource = 'helius_webhook_program';
    let confidence: number = CONF.PROGRAM;
    if (fromProgram === 'pump_fun' && hasStructuredMayhemFlag(input.raw_metadata)) {
      protocol_id = 'pump_fun_mayhem';
      source = 'metadata_structured';
      confidence = CONF.MAYHEM_STRUCTURED;
    }
    return buildResult({ protocol_id, classification_source: source, source_confidence: confidence }, input);
  }

  if (input.das_authority_pad) {
    const fromPad = inferLaunchPadProtocol(input.das_authority_pad);
    if (fromPad) {
      let protocol_id: CanonicalProtocolId = fromPad;
      if (fromPad === 'pump_fun' && hasStructuredMayhemFlag(input.raw_metadata)) protocol_id = 'pump_fun_mayhem';
      return buildResult({ protocol_id, classification_source: 'helius_das_authority', source_confidence: CONF.DAS_AUTHORITY }, input);
    }
  }

  if (input.gecko_pool && input.gecko_network) {
    const geckoDex = parseGeckoDexProtocol(input.gecko_pool, input.gecko_network);
    if (geckoDex) {
      return buildResult({
        protocol_id: geckoDex.protocol_id,
        dex_id: geckoDex.dex_id,
        classification_source: 'gecko_dex',
        source_confidence: CONF.GECKO_DEX,
        token_kind: 'erc20',
        launch_type: 'dex_pool',
        migration_state: 'unknown',
      }, input);
    }
    return buildResult({
      protocol_id: genericEvmProtocol(input.gecko_network),
      classification_source: 'gecko_dex',
      source_confidence: CONF.EVM_GENERIC,
      token_kind: 'erc20',
      launch_type: 'dex_pool',
      migration_state: 'unknown',
    }, input);
  }

  if (input.dexscreener_dex_id) {
    const dexId = input.dexscreener_dex_id.trim().toLowerCase();
    if (dexId === 'pumpfun') {
      return buildResult({
        protocol_id: 'pump_fun',
        classification_source: 'dexscreener_dex',
        source_confidence: CONF.DEXSCREENER,
      }, input);
    }
    const mapped = canonicalProtocolFromDexscreenerId(input.dexscreener_dex_id, chain_id);
    if (mapped) {
      return buildResult({
        protocol_id: mapped,
        dex_id: input.dexscreener_dex_id,
        classification_source: 'dexscreener_dex',
        source_confidence: CONF.DEXSCREENER,
        token_kind: chain_id === 'sol' ? 'bonding_curve' : 'erc20',
        launch_type: chain_id === 'sol' ? 'bonding_curve' : 'dex_pool',
        migration_state: 'unknown',
      }, input);
    }
  }

  const raw = asRecord(input.raw_metadata);
  const content = asRecord(raw?.content);
  const jsonUri = typeof raw?.json_uri === 'string' ? raw.json_uri : typeof content?.json_uri === 'string' ? content.json_uri : undefined;
  const fromUri = inferUriProtocol(jsonUri);
  if (fromUri) {
    let protocol_id: CanonicalProtocolId = fromUri;
    if (fromUri === 'pump_fun' && hasStructuredMayhemFlag(input.raw_metadata)) protocol_id = 'pump_fun_mayhem';
    return buildResult({ protocol_id, classification_source: 'helius_das_uri', source_confidence: CONF.DAS_URI, token_kind: chain_id === 'sol' ? 'bonding_curve' : 'unknown' }, input);
  }

  if (chain_id === 'sol' && input.mint.toLowerCase().endsWith('pump')) {
    let protocol_id: CanonicalProtocolId = 'pump_fun';
    if (hasStructuredMayhemFlag(input.raw_metadata)) protocol_id = 'pump_fun_mayhem';
    return buildResult({
      protocol_id,
      classification_source: 'helius_das_uri',
      source_confidence: CONF.DAS_URI,
      token_kind: 'bonding_curve',
    }, input);
  }

  const fromMeta = inferMetadataKeywordProtocol(input.raw_metadata);
  if (fromMeta) {
    let protocol_id: CanonicalProtocolId = fromMeta;
    if (fromMeta === 'pump_fun' && hasStructuredMayhemFlag(input.raw_metadata)) protocol_id = 'pump_fun_mayhem';
    return buildResult({
      protocol_id,
      classification_source: 'helius_das_uri',
      source_confidence: CONF.METADATA_KEYWORD,
      token_kind: 'bonding_curve',
    }, input);
  }

  if (chain_id === 'ton' || input.launch_pad === 'ton') {
    return buildResult({
      protocol_id: 'ton',
      classification_source: 'tonapi_jetton',
      source_confidence: CONF.TON_GENERIC,
      token_kind: 'native_jetton',
      launch_type: 'unknown',
      migration_state: 'unknown',
    }, input);
  }

  const fromLegacy = inferLaunchPadProtocol(input.launch_pad);
  if (fromLegacy) {
    let protocol_id: CanonicalProtocolId = fromLegacy;
    if (fromLegacy === 'pump_fun' && hasStructuredMayhemFlag(input.raw_metadata)) protocol_id = 'pump_fun_mayhem';
    const isEvmGeneric = fromLegacy === 'eth' || fromLegacy === 'bsc' || fromLegacy === 'base';
    return buildResult({
      protocol_id,
      classification_source: 'launch_pad_legacy',
      source_confidence: CONF.LAUNCH_PAD,
      token_kind: isEvmGeneric ? 'erc20' : chain_id === 'sol' ? 'bonding_curve' : 'unknown',
      launch_type: isEvmGeneric ? 'dex_pool' : 'bonding_curve',
    }, input);
  }

  const generic =
    chain_id === 'eth' ? 'eth' : chain_id === 'bnb' ? 'bsc' : chain_id === 'base' ? 'base' : null;

  if (chain_id === 'sol' && !generic) {
    return buildResult({
      protocol_id: null,
      protocol_family: null,
      classification_source: resolveUnknownClassificationSource(input.ingest_hint),
      source_confidence: 0,
      token_kind: 'spl',
      launch_type: 'unknown',
      migration_state: 'unknown',
    }, input);
  }

  return buildResult({
    protocol_id: generic,
    protocol_family: generic ? 'evm' : null,
    classification_source: input.ingest_hint ?? 'launch_pad_legacy',
    source_confidence: generic ? CONF.EVM_GENERIC : 0,
    token_kind: chain_id === 'sol' ? 'spl' : 'erc20',
    launch_type: 'unknown',
    migration_state: 'unknown',
  }, input);
}

export function classificationToDbPatch(c: TokenClassification) {
  return {
    protocol_id: c.protocol_id,
    protocol_family: c.protocol_family,
    chain_id: c.chain_id,
    token_kind: c.token_kind,
    launch_type: c.launch_type,
    migration_state: c.migration_state,
    dex_id: c.dex_id,
    classification_source: c.classification_source,
    source_confidence: c.source_confidence,
    classification_updated_at: new Date().toISOString(),
  };
}

export function shouldApplyClassification(
  existing: Partial<{ source_confidence?: number | null; protocol_id?: string | null }> | null | undefined,
  incoming: TokenClassification,
): boolean {
  const prev = existing?.source_confidence ?? 0;
  if (incoming.source_confidence > prev) return true;
  if (incoming.source_confidence === prev && !existing?.protocol_id && incoming.protocol_id) return true;
  if (incoming.migration_state === 'migrated' && incoming.source_confidence >= CONF.MIGRATION - 0.01) {
    return incoming.source_confidence >= prev;
  }
  return false;
}
