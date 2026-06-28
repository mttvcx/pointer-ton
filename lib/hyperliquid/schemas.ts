import { z } from 'zod';

const HlLevelSchema = z.object({
  px: z.string(),
  sz: z.string(),
  n: z.number(),
});

export const HlL2BookSchema = z.object({
  coin: z.string(),
  levels: z.tuple([z.array(HlLevelSchema), z.array(HlLevelSchema)]),
});

export const HlMetaAndCtxSchema = z.tuple([
  z.object({
    universe: z.array(
      z.object({
        name: z.string(),
        szDecimals: z.number(),
        maxLeverage: z.number(),
        onlyIsolated: z.boolean().optional(),
      }),
    ),
  }),
  z.array(
    z.object({
      funding: z.string(),
      openInterest: z.string(),
      prevDayPx: z.string(),
      dayNtlVlm: z.string(),
      markPx: z.string(),
      midPx: z.string().nullable().optional(),
      oraclePx: z.string().nullable().optional(),
      premium: z.string().nullable().optional(),
    }),
  ),
]);

const HlAssetPositionSchema = z.object({
  position: z.object({
    coin: z.string(),
    szi: z.string(),
    entryPx: z.string().nullable().optional(),
    positionValue: z.string().optional(),
    unrealizedPnl: z.string().optional(),
    returnOnEquity: z.string().optional(),
    liquidationPx: z.string().nullable().optional(),
    marginUsed: z.string().optional(),
    leverage: z.object({ type: z.string(), value: z.number() }).optional(),
  }),
});

/** Hyperliquid `clearinghouseState` — a user's perps account (margin + positions). */
export const HlClearinghouseStateSchema = z.object({
  marginSummary: z.object({
    accountValue: z.string(),
    totalNtlPos: z.string().optional(),
    totalRawUsd: z.string().optional(),
    totalMarginUsed: z.string().optional(),
  }),
  withdrawable: z.string().optional(),
  assetPositions: z.array(HlAssetPositionSchema),
  time: z.number().optional(),
});

export type HlMetaAndCtx = z.infer<typeof HlMetaAndCtxSchema>;
export type HlL2Book = z.infer<typeof HlL2BookSchema>;
export type HlClearinghouseState = z.infer<typeof HlClearinghouseStateSchema>;
