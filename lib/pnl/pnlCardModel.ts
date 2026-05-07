import { z } from 'zod';

export const PnlCardDataSchema = z
  .object({
    mint: z.string(),
    symbol: z.string().nullable(),
    name: z.string().nullable(),
    imageUrl: z.string().nullable(),
    side: z.enum(['buy', 'sell']),
    submittedAt: z.string(),
    confirmedAt: z.string().nullable(),
    amountSol: z.number().nullable(),
    amountToken: z.number().nullable(),
    decimals: z.number().int(),
    priceUsdAtFill: z.number().nullable(),
    txSignature: z.string(),
    displayRealizedPnlSol: z.number().nullable().optional(),
    displayRealizedPnlUsd: z.number().nullable().optional(),
  })
  .strict();

export type PnlCardData = z.infer<typeof PnlCardDataSchema>;

export function parsePnlCardData(raw: unknown): PnlCardData | null {
  const r = PnlCardDataSchema.safeParse(raw);
  return r.success ? r.data : null;
}
