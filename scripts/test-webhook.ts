/**
 * Simulate Helius enhanced webhook deliveries against the local dev server.
 * No ngrok required — exercises the full ingest pipeline on localhost.
 *
 * Usage:
 *   npm run test:webhook
 *   npm run test:webhook -- --scenario create
 *   npm run test:webhook -- --scenario bonding --mint <existing-mint>
 *   npm run test:webhook -- --port 3001 --base-url http://127.0.0.1:3001
 */
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { config } from 'dotenv';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import {
  LAUNCHPAD_PROGRAM_IDS,
  MIGRATION_PROGRAM_IDS,
} from '../lib/utils/constants';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

type Scenario = 'create' | 'bonding' | 'migration' | 'all';

const PUMP_FUN = LAUNCHPAD_PROGRAM_IDS.pumpFun;
const PUMP_SWAP = MIGRATION_PROGRAM_IDS.pumpSwap;

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
  return v;
}

function fakeTxSignature(label: string): string {
  const seed = Buffer.concat([Buffer.from(label, 'utf8'), randomBytes(32)]);
  return bs58.encode(seed).slice(0, 88).padEnd(88, '1');
}

function parseArgs(argv: string[]) {
  let scenario: Scenario = 'all';
  let port = process.env.PORT?.trim() || '3001';
  let baseUrl = process.env.WEBHOOK_TEST_BASE_URL?.trim() || '';
  let mint = process.env.WEBHOOK_TEST_MINT?.trim() || '';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--scenario' && argv[i + 1]) {
      scenario = argv[i + 1] as Scenario;
      i += 1;
    } else if (arg === '--port' && argv[i + 1]) {
      port = argv[i + 1]!;
      i += 1;
    } else if (arg === '--base-url' && argv[i + 1]) {
      baseUrl = argv[i + 1]!;
      i += 1;
    } else if (arg === '--mint' && argv[i + 1]) {
      mint = argv[i + 1]!;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: npm run test:webhook -- [options]

Options:
  --scenario create|bonding|migration|all   Which payload to send (default: all)
  --port 3001                               Dev server port
  --base-url http://127.0.0.1:3001          Override webhook origin
  --mint <pubkey>                           Token mint (required for bonding/migration alone)
`);
      process.exit(0);
    }
  }

  const origin = baseUrl || `http://127.0.0.1:${port}`;
  return { scenario, origin, mint };
}

function buildCreatePayload(mint: string, creator: string, signature: string) {
  return [
    {
      signature,
      type: 'UNKNOWN',
      source: 'PUMP_FUN',
      feePayer: creator,
      instructions: [{ programId: PUMP_FUN, program: 'pump.fun' }],
      tokenTransfers: [
        {
          mint,
          symbol: 'PWTEST',
          name: 'Pointer Webhook Test',
          tokenAmount: 1_000_000,
          fromUserAccount: creator,
          toUserAccount: creator,
        },
      ],
      nativeTransfers: [{ amount: 1_500_000_000, fromUserAccount: creator, toUserAccount: creator }],
      description: 'Simulated pump.fun token creation',
    },
  ];
}

function buildBondingPayload(mint: string, creator: string, signature: string) {
  return [
    {
      signature,
      type: 'SWAP',
      source: 'PUMP_FUN',
      feePayer: creator,
      instructions: [{ programId: PUMP_FUN, program: 'pump.fun' }],
      tokenTransfers: [{ mint, symbol: 'PWTEST', name: 'Pointer Webhook Test' }],
      /** Direct percent — picked up by extractBondingProgressPct */
      bonding_curve_progress: 85,
      /** Axiom-style F scale (8.5 → 85%) — alternate path parsers accept */
      extended_metrics: { F: 8.5, quoteSymbol: 'SOL' },
      description: 'Simulated pump.fun buy pushing bonding curve to 85%',
    },
  ];
}

function buildMigrationPayload(mint: string, signature: string) {
  return [
    {
      signature,
      type: 'UNKNOWN',
      source: 'PUMP_AMM',
      feePayer: Keypair.generate().publicKey.toBase58(),
      instructions: [{ programId: PUMP_SWAP, program: 'pump_amm' }],
      tokenTransfers: [
        {
          mint,
          symbol: 'PWTEST',
          name: 'Pointer Webhook Test',
          tokenAmount: 500_000,
        },
      ],
      description: 'Simulated PumpSwap migration pool creation',
    },
  ];
}

async function postWebhook(
  origin: string,
  authToken: string,
  body: unknown,
  label: string,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const url = `${origin.replace(/\/$/, '')}/api/webhooks/helius`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });

  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = { error: 'non_json_response' };
  }

  const ok = res.ok;
  const icon = ok ? '✓' : '✗';
  console.log(`\n${icon} ${label}`);
  console.log(`  POST ${url} → ${res.status}`);
  console.log(`  ${JSON.stringify(json)}`);

  return { ok, status: res.status, json };
}

async function main(): Promise<void> {
  const { scenario, origin, mint: mintArg } = parseArgs(process.argv.slice(2));
  const authToken = requireEnv('HELIUS_WEBHOOK_AUTH_TOKEN');

  const creator = Keypair.generate().publicKey.toBase58();
  const mint = mintArg || Keypair.generate().publicKey.toBase58();

  console.log('Pointer local webhook test');
  console.log(`  Target:  ${origin}/api/webhooks/helius`);
  console.log(`  Mint:    ${mint}`);
  console.log(`  Creator: ${creator}`);

  const runCreate = scenario === 'all' || scenario === 'create';
  const runBonding = scenario === 'all' || scenario === 'bonding';
  const runMigration = scenario === 'all' || scenario === 'migration';

  if ((runBonding || runMigration) && !mintArg && scenario !== 'all') {
    console.error('--mint is required when running bonding or migration alone');
    process.exit(1);
  }

  let failures = 0;

  if (runCreate) {
    const r = await postWebhook(
      origin,
      authToken,
      buildCreatePayload(mint, creator, fakeTxSignature('create')),
      '1/3 New pump.fun token creation',
    );
    if (!r.ok) failures += 1;
  }

  if (runBonding) {
    const r = await postWebhook(
      origin,
      authToken,
      buildBondingPayload(mint, creator, fakeTxSignature('bonding')),
      '2/3 Token reaches 85% bonding curve',
    );
    if (!r.ok) failures += 1;
  }

  if (runMigration) {
    const r = await postWebhook(
      origin,
      authToken,
      buildMigrationPayload(mint, fakeTxSignature('migration')),
      '3/3 Token migration to PumpSwap',
    );
    if (!r.ok) failures += 1;
  }

  console.log('\nDone.');
  if (scenario === 'all') {
    console.log(`Check Pulse: NEW → STRETCH (≥85%) → MIGRATED for mint ${mint}`);
    console.log('Re-run with: npm run test:webhook -- --scenario bonding --mint', mint);
  }

  if (failures > 0) {
    console.error(`\n${failures} request(s) failed. Is npm run dev running on ${origin}?`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
