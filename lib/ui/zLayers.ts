/**
 * Centralized stacking for full-viewport overlays.
 *
 * Floating dock peek panels (Pulse / Wallet Tracker) sit at `z-[220]`–`z-[221]`.
 * App modals must sit above those or they appear "behind" draggable dock UIs.
 *
 * Brief alert flash previews use `z-[300]` so a demo flash can still paint over
 * modal chrome when testing notifications from inside a dialog.
 */
export const Z_APP_MODAL_OVERLAY = 'z-[280]' as const;
