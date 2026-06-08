-- Live verification queries for P0 protocol classification.
-- Run in Supabase SQL Editor after migration + backfill.

-- 1) protocol_id distribution by chain
SELECT
  COALESCE(chain_id, 'unknown_chain') AS chain,
  COALESCE(protocol_id, '(null)') AS protocol_id,
  COUNT(*) AS n
FROM tokens
GROUP BY 1, 2
ORDER BY 1, 3 DESC;

-- 2) source_confidence distribution (bucketed)
SELECT
  CASE
    WHEN source_confidence IS NULL THEN 'null'
    WHEN source_confidence >= 0.95 THEN '0.95+ (program/migration)'
    WHEN source_confidence >= 0.85 THEN '0.85–0.94 (gecko/dex)'
    WHEN source_confidence >= 0.60 THEN '0.60–0.84 (uri/legacy)'
    WHEN source_confidence >= 0.50 THEN '0.50–0.59 (filter threshold)'
    ELSE '<0.50 (no filter match)'
  END AS confidence_bucket,
  COUNT(*) AS n
FROM tokens
GROUP BY 1
ORDER BY 1;

-- 3) unknown / null protocol rows
SELECT
  mint,
  chain_id,
  launch_pad,
  protocol_id,
  source_confidence,
  classification_source
FROM tokens
WHERE protocol_id IS NULL OR source_confidence IS NULL OR source_confidence < 0.5
ORDER BY created_at DESC
LIMIT 100;

-- 4) migrated Solana rows
SELECT
  mint,
  protocol_id,
  migration_state,
  migrated_to,
  dex_id,
  source_confidence,
  classification_source,
  migrated_at
FROM tokens
WHERE migrated_at IS NOT NULL
  AND (chain_id = 'sol' OR launch_pad IN ('pump.fun', 'bonk', 'bags', 'printr', 'moonshot', 'heaven', 'dynamic-bc'))
ORDER BY migrated_at DESC
LIMIT 100;

-- 5) EVM rows classified from Gecko DEX
SELECT
  mint,
  chain_id,
  protocol_id,
  dex_id,
  classification_source,
  source_confidence,
  launch_pad
FROM tokens
WHERE classification_source = 'gecko_dex'
   OR (chain_id IN ('eth', 'bnb', 'base') AND protocol_id IN ('pancakeswap', 'uniswap', 'uniswap_v2', 'uniswap_v3', 'uniswap_v4'))
ORDER BY classification_updated_at DESC NULLS LAST
LIMIT 100;

-- 6) TON rows staying generic ton
SELECT
  mint,
  protocol_id,
  chain_id,
  token_kind,
  classification_source,
  source_confidence,
  launch_pad
FROM tokens
WHERE chain_id = 'ton' OR launch_pad = 'ton'
ORDER BY created_at DESC
LIMIT 100;

-- 7) Sol ingest source vs classification honesty
SELECT
  COALESCE(raw_metadata->>'pointerIngestSource', '(none)') AS ingest_source,
  COALESCE(classification_source, '(null)') AS classification_source,
  COUNT(*) AS n,
  COUNT(*) FILTER (WHERE protocol_id IS NULL OR source_confidence < 0.5) AS unknown_n
FROM tokens
WHERE chain_id = 'sol'
   OR launch_pad IN ('pump.fun', 'bonk', 'bags', 'printr', 'moonshot', 'heaven', 'dynamic-bc')
GROUP BY 1, 2
ORDER BY 1, 2;

-- 8) Sol unknown rate (Pulse-visible threshold)
SELECT
  COUNT(*) FILTER (WHERE protocol_id IS NULL OR source_confidence < 0.5) AS sol_unknown,
  COUNT(*) AS sol_total,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE protocol_id IS NULL OR source_confidence < 0.5) / NULLIF(COUNT(*), 0),
    2
  ) AS sol_unknown_pct
FROM tokens
WHERE chain_id = 'sol'
   OR launch_pad IN ('pump.fun', 'bonk', 'bags', 'printr', 'moonshot', 'heaven', 'dynamic-bc');

-- Sample row for screenshot (protocol_id + source_confidence)
SELECT
  mint,
  symbol,
  chain_id,
  protocol_id,
  protocol_family,
  token_kind,
  migration_state,
  dex_id,
  classification_source,
  source_confidence,
  classification_updated_at
FROM tokens
WHERE protocol_id IS NOT NULL AND source_confidence >= 0.5
ORDER BY classification_updated_at DESC NULLS LAST
LIMIT 10;
