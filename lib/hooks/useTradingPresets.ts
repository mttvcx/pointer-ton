'use client';

import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import type { MevMode } from '@/lib/trading/mevMode';
import type { PresetSlot } from '@/store/trading';

export type TradingPreset = {
  slot: PresetSlot;
  name: string;
  buy_amounts_sol: number[];
  slippage_bps: number;
  dynamic_slippage: boolean;
  mev_mode: MevMode;
  priority_fee_lamports: number;
  jito_tip_lamports: number;
  auto_fee: boolean;
  max_fee_sol: number;
};

/**
 * The three trade presets (P1/P2/P3). Shares the `['trading-presets']`
 * react-query cache with `usePulseQuickBuy`, so reading this anywhere costs no
 * extra network — it just exposes the cached preset list for display (e.g. the
 * P1/P2/P3 hover cards in the Pulse column header).
 */
export function useTradingPresets(): TradingPreset[] {
  const { getAccessToken, authenticated } = usePointerAuth();
  const { data } = useQuery({
    queryKey: ['trading-presets'],
    queryFn: async (): Promise<{ presets: TradingPreset[] } | null> => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch('/api/presets', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return res.json() as Promise<{ presets: TradingPreset[] }>;
    },
    enabled: authenticated,
    staleTime: 60_000,
  });
  return data?.presets ?? [];
}
