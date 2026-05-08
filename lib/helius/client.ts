import 'server-only';
import { createHelius } from 'helius-sdk';
import type { HeliusClient } from 'helius-sdk';

let _client: HeliusClient | null = null;

export function getHeliusClient(): HeliusClient {
  if (_client) return _client;
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    throw new Error('HELIUS_API_KEY is not set (required for Helius DAS / legacy Solana ingest)');
  }
  _client = createHelius({ apiKey, network: 'mainnet' });
  return _client;
}
