import {
  LAUNCHPAD_PROGRAM_IDS,
  MIGRATION_PROGRAM_IDS,
} from '@/lib/utils/constants';

/** Account addresses watched by the Pulse Helius enhanced webhook. */
export const HELIUS_PULSE_WEBHOOK_ADDRESSES: readonly string[] = [
  LAUNCHPAD_PROGRAM_IDS.pumpFun,
  'TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM',
  'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ',
  MIGRATION_PROGRAM_IDS.pumpSwap,
  LAUNCHPAD_PROGRAM_IDS.bonk,
  LAUNCHPAD_PROGRAM_IDS.moonshot,
  LAUNCHPAD_PROGRAM_IDS.bags,
  LAUNCHPAD_PROGRAM_IDS.heaven,
  LAUNCHPAD_PROGRAM_IDS.believeDbc,
  MIGRATION_PROGRAM_IDS.raydiumAmmV4,
  MIGRATION_PROGRAM_IDS.raydiumClmm,
  MIGRATION_PROGRAM_IDS.meteoraDammV2,
  MIGRATION_PROGRAM_IDS.meteoraDlmm,
];

export type HeliusPulseWebhookConfig = {
  webhookURL: string;
  webhookType: 'enhanced';
  transactionTypes: ['ANY'];
  txnStatus: 'all';
  encoding: 'json';
  authHeader: string;
  accountAddresses: string[];
};

export function buildHeliusPulseWebhookConfig(opts: {
  webhookURL: string;
  authToken: string;
}): HeliusPulseWebhookConfig {
  const url = opts.webhookURL.replace(/\/$/, '');
  const webhookURL = url.endsWith('/api/webhooks/helius') ? url : `${url}/api/webhooks/helius`;
  return {
    webhookURL,
    webhookType: 'enhanced',
    transactionTypes: ['ANY'],
    txnStatus: 'all',
    encoding: 'json',
    authHeader: `Bearer ${opts.authToken}`,
    accountAddresses: [...HELIUS_PULSE_WEBHOOK_ADDRESSES],
  };
}
