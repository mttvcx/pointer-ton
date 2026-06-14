import { z } from 'zod';

const fpDollars = z.union([z.string(), z.number()]).optional();

export const KalshiMarketSchema = z
  .object({
    ticker: z.string(),
    event_ticker: z.string().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    yes_sub_title: z.string().optional(),
    no_sub_title: z.string().optional(),
    status: z.string().optional(),
    last_price_dollars: fpDollars,
    yes_bid_dollars: fpDollars,
    yes_ask_dollars: fpDollars,
    no_bid_dollars: fpDollars,
    no_ask_dollars: fpDollars,
    previous_price_dollars: fpDollars,
    volume_fp: z.union([z.string(), z.number()]).optional(),
    volume_24h_fp: z.union([z.string(), z.number()]).optional(),
    open_interest_fp: z.union([z.string(), z.number()]).optional(),
    liquidity_dollars: fpDollars,
    close_time: z.string().optional(),
    open_time: z.string().optional(),
    category: z.string().optional(),
  })
  .passthrough();

export const KalshiMarketsResponseSchema = z.object({
  markets: z.array(KalshiMarketSchema).default([]),
  cursor: z.string().optional().nullable(),
});

export const KalshiTradeSchema = z.object({
  trade_id: z.string().optional(),
  ticker: z.string(),
  yes_price_dollars: fpDollars,
  no_price_dollars: fpDollars,
  count_fp: z.union([z.string(), z.number()]).optional(),
  count: z.number().optional(),
  taker_side: z.enum(['yes', 'no']).optional(),
  created_time: z.string().optional(),
});

export const KalshiTradesResponseSchema = z.object({
  trades: z.array(KalshiTradeSchema).default([]),
  cursor: z.string().optional().nullable(),
});

export const KalshiEventSchema = z
  .object({
    event_ticker: z.string(),
    title: z.string().optional(),
    category: z.string().optional(),
    sub_title: z.string().optional(),
  })
  .passthrough();

export const KalshiEventWithMarketsSchema = KalshiEventSchema.extend({
  markets: z.array(KalshiMarketSchema).optional().default([]),
});

export const KalshiEventsResponseSchema = z.object({
  events: z.array(KalshiEventWithMarketsSchema).default([]),
  cursor: z.string().optional().nullable(),
});

export const CreateOrderBodySchema = z.object({
  ticker: z.string().min(1),
  side: z.enum(['yes', 'no']),
  action: z.enum(['buy', 'sell']),
  /** Whole contracts. */
  count: z.number().int().min(1).max(10_000),
  /** Limit price in cents (1–99). */
  yes_price: z.number().int().min(1).max(99).optional(),
  no_price: z.number().int().min(1).max(99).optional(),
  type: z.enum(['limit', 'market']).default('limit'),
});

export type KalshiMarket = z.infer<typeof KalshiMarketSchema>;
export type KalshiTrade = z.infer<typeof KalshiTradeSchema>;
export type CreateOrderBody = z.infer<typeof CreateOrderBodySchema>;
