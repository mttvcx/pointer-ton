import type { QueryClient } from '@tanstack/react-query';
import type { AppChainId } from '@/lib/chains/appChain';
import { PULSE_COLUMNS, type PulseColumnId } from '@/lib/utils/constants';
import {
  normalizeColumnDisplayOptions,
  normalizeColumnFilters,
} from '@/lib/tokens/columnPresetModel';
import {
  recommendedColumnDisplayOptions,
  recommendedColumnFilters,
  recommendedPulseDisplayPrefs,
} from '@/lib/pulse/pulseRecommendedSettings';
import { usePulseDisplayPrefsStore } from '@/store/pulseDisplayPrefs';
import { usePulseColumnStore, type ColumnPulsePresetSlot } from '@/store/pulseColumns';

const PRESET_SLOTS: ColumnPulsePresetSlot[] = [1, 2, 3];

export async function applyPulseRecommendedSettings(params: {
  chain: AppChainId;
  authenticated: boolean;
  getAccessToken: () => Promise<string | null>;
  queryClient?: QueryClient;
}): Promise<{ savedRemote: boolean }> {
  const { chain, authenticated, getAccessToken, queryClient } = params;

  const displayPrefs = recommendedPulseDisplayPrefs(chain);
  usePulseDisplayPrefsStore.getState().setPrefs(displayPrefs);

  const displayOptions = normalizeColumnDisplayOptions(recommendedColumnDisplayOptions());
  const colStore = usePulseColumnStore.getState();
  colStore.setBuyButtonStyleAll(displayPrefs.quickBuyButtonSize);
  for (const column of PULSE_COLUMNS) {
    colStore.setQuickBuySol(column, displayPrefs.displayQuickBuySol);
  }

  let savedRemote = false;

  if (authenticated) {
    const token = await getAccessToken();
    if (token) {
      for (const column_id of PULSE_COLUMNS) {
        const filters = normalizeColumnFilters(
          recommendedColumnFilters(chain, column_id as PulseColumnId),
          chain,
        );
        const res = await fetch('/api/pulse/column-presets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            column_id,
            preset_slot: 1,
            apply_all_slots: true,
            filters,
            display_options: displayOptions,
            sort_by: 'created_at',
            sort_dir: 'desc',
          }),
        });
        if (!res.ok) {
          throw new Error(`preset_save_${column_id}`);
        }
        queryClient?.invalidateQueries({ queryKey: ['pulse-column-presets', column_id] });
      }
      savedRemote = true;
    }
  }

  if (!savedRemote) {
    for (const column of PULSE_COLUMNS) {
      const filters = normalizeColumnFilters(recommendedColumnFilters(chain, column), chain);
      for (const slot of PRESET_SLOTS) {
        colStore.setLocalColumnFilters(column, slot, filters);
      }
      colStore.setPresetSlot(column, 1);
    }
  }

  return { savedRemote };
}
