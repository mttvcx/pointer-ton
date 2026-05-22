import { DEFAULT_AUTO_BUY_PREFS, useAutoBuyStore } from '@/store/autoBuy';
import { usePulseColumnStore } from '@/store/pulseColumns';

/** rule.buySolPreset → Pulse `new` column quickBuySol → prefs.defaultAutoBuySol */
export function resolveAutoBuyAmountSol(buySolPreset?: number | null): number {
  if (buySolPreset != null && Number.isFinite(buySolPreset) && buySolPreset > 0) {
    return buySolPreset;
  }
  const columnSol = usePulseColumnStore.getState().byColumn.new.quickBuySol;
  if (Number.isFinite(columnSol) && columnSol > 0) return columnSol;
  const fallback = useAutoBuyStore.getState().defaultAutoBuySol;
  return Number.isFinite(fallback) && fallback > 0 ? fallback : DEFAULT_AUTO_BUY_PREFS.defaultAutoBuySol;
}
