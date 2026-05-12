import { useUIStore } from '@/store/ui';

export const POINTER_COPILOT_QUICK_ASK_EVENT = 'pointer-copilot-quick-ask';

/**
 * Pins an entity on the docked AI rail and submits a tooltip-term ask (existing Ask Pointer pipeline).
 * Forces panel mode so the response surface is visible.
 */
export function openCopilotQuickAsk(opts: {
  entity: { type: 'token' | 'wallet'; id: string; label?: string };
  question: string;
}) {
  const st = useUIStore.getState();
  st.setCopilotDisplayMode('panel');
  st.setCopilotDetached(false);
  st.setCopilotFloatHeight(null);
  st.setPanelOpen(true);
  st.setPanelCollapsed(false);
  st.setLocked({ type: opts.entity.type, id: opts.entity.id, label: opts.entity.label }, 'manual');

  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent(POINTER_COPILOT_QUICK_ASK_EVENT, { detail: opts.question }));
  });
}
