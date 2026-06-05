import { z } from 'zod';
import { APP_CHAIN_IDS } from '@/lib/chains/appChain';

export const onramperSignatureRequestSchema = z.object({
  activeChain: z.enum(APP_CHAIN_IDS),
  walletAddress: z.string().trim().min(1),
  defaultFiat: z.string().trim().optional(),
  fiatAmount: z.number().finite().positive().max(500_000).optional(),
  partnerContext: z.string().trim().optional(),
});

export const onramperSignatureResponseSchema = z.object({
  widgetUrl: z.string().url(),
  signed: z.boolean(),
});

export const onramperSignatureErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});
