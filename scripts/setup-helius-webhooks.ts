/**
 * Register (or refresh) the Pulse Helius enhanced webhook.
 *
 * Usage:
 *   node --use-system-ca --import tsx scripts/setup-helius-webhooks.ts [public-origin-url]
 *
 * Helius rejects localhost — for local dev pass your ngrok HTTPS origin.
 *
 * Writes HELIUS_WEBHOOK_ID to .env.local on success.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { buildHeliusPulseWebhookConfig } from '../lib/helius/heliusWebhookConfig';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

const HELIUS_API_BASE = 'https://api-mainnet.helius-rpc.com/v0/webhooks';

type HeliusWebhook = {
  webhookID: string;
  webhookURL: string;
  webhookType: string;
  accountAddresses?: string[];
};

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
  return v;
}

function upsertEnvLocal(key: string, value: string): void {
  const envPath = path.join(process.cwd(), '.env.local');
  let contents = '';
  try {
    contents = readFileSync(envPath, 'utf8');
  } catch {
    console.error('.env.local not found — create it from .env.example first');
    process.exit(1);
  }
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  const next = re.test(contents)
    ? contents.replace(re, line)
    : `${contents.trimEnd()}\n${line}\n`;
  writeFileSync(envPath, next, 'utf8');
  console.log(`Updated .env.local → ${key}=${value}`);
}

async function heliusFetch<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Helius ${method} ${url} → ${res.status}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

async function main(): Promise<void> {
  const apiKey = requireEnv('HELIUS_API_KEY');
  const authToken = requireEnv('HELIUS_WEBHOOK_AUTH_TOKEN');
  const appUrl = process.argv[2]?.trim() || requireEnv('NEXT_PUBLIC_APP_URL');

  if (/localhost|127\.0\.0\.1/.test(appUrl)) {
    console.error('Helius requires a public HTTPS webhook URL (localhost is rejected).');
    console.error('');
    console.error('Local dev:');
    console.error('  1. ./scripts/dev-tunnel.sh');
    console.error('  2. node --use-system-ca --import tsx scripts/setup-helius-webhooks.ts https://YOUR-NGROK-URL');
    process.exit(1);
  }

  const payload = buildHeliusPulseWebhookConfig({
    webhookURL: appUrl,
    authToken,
  });

  const listUrl = `${HELIUS_API_BASE}?api-key=${encodeURIComponent(apiKey)}`;
  const existing = await heliusFetch<HeliusWebhook[]>('GET', listUrl);
  const existingId = process.env.HELIUS_WEBHOOK_ID?.trim();
  const match = existing.find(
    (w) => w.webhookID === existingId || w.webhookURL === payload.webhookURL,
  );

  let webhook: HeliusWebhook;
  if (match) {
    console.log(`Updating existing webhook ${match.webhookID}…`);
    webhook = await heliusFetch<HeliusWebhook>(
      'PUT',
      `${HELIUS_API_BASE}/${match.webhookID}?api-key=${encodeURIComponent(apiKey)}`,
      payload,
    );
  } else {
    console.log('Creating Pulse enhanced webhook…');
    webhook = await heliusFetch<HeliusWebhook>(
      'POST',
      listUrl,
      payload,
    );
  }

  console.log('\nRegistered webhook:');
  console.log(JSON.stringify(webhook, null, 2));
  upsertEnvLocal('HELIUS_WEBHOOK_ID', webhook.webhookID);
  console.log('\nDone. For local dev with ngrok:');
  console.log('  ./scripts/dev-tunnel.sh');
  console.log('  node --use-system-ca --import tsx scripts/update-webhook-url.ts https://YOUR-NGROK-URL');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
