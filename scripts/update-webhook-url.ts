/**
 * Point the registered Helius Pulse webhook at a new public URL (ngrok, staging, prod).
 *
 * Usage:
 *   node --use-system-ca --import tsx scripts/update-webhook-url.ts https://abc123.ngrok-free.app
 */
import path from 'node:path';
import { config } from 'dotenv';
import { buildHeliusPulseWebhookConfig } from '../lib/helius/heliusWebhookConfig';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

const HELIUS_API_BASE = 'https://api-mainnet.helius-rpc.com/v0/webhooks';

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  const publicOrigin = process.argv[2]?.trim();
  if (!publicOrigin) {
    console.error('Usage: npx tsx scripts/update-webhook-url.ts <public-origin-url>');
    console.error('Example: npx tsx scripts/update-webhook-url.ts https://abc123.ngrok-free.app');
    process.exit(1);
  }

  const apiKey = requireEnv('HELIUS_API_KEY');
  const authToken = requireEnv('HELIUS_WEBHOOK_AUTH_TOKEN');
  const webhookId = requireEnv('HELIUS_WEBHOOK_ID');

  const payload = buildHeliusPulseWebhookConfig({
    webhookURL: publicOrigin.replace(/\/$/, ''),
    authToken,
  });

  const url = `${HELIUS_API_BASE}/${webhookId}?api-key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Helius PUT ${url} → ${res.status}: ${text}`);
  }

  console.log('Webhook URL updated:');
  console.log(JSON.stringify(JSON.parse(text), null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
