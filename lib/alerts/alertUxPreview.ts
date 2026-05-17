/** Test Pulse alert UX (screen tint + caller controls sound separately). Dispatched across the shell. */
export const POINTER_ALERT_UX_PREVIEW_EVT = 'pointer:alertUxPreview';

export type AlertUxPreviewDetail = {
  color: string;
  size: 'normal' | 'large';
};

/** Fire a viewport flash timed like a real ticker-driven alert flash. */
export function dispatchAlertFlashPreview(detail: AlertUxPreviewDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(POINTER_ALERT_UX_PREVIEW_EVT, { detail }));
}
