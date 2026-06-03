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

export type HlMetaAndCtx = z.infer<typeof HlMetaAndCtxSchema>;
export type HlL2Book = z.infer<typeof HlL2BookSchema>;
