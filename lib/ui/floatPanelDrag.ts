/** Shared guard: pointer originated on non-interactive chrome (safe to start a panel drag). */
export function isFloatPanelDragSurface(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.closest('[data-float-resize="1"]')) return false;
  if (el.closest('button, a, input, textarea, select, [contenteditable="true"], [role="textbox"]')) {
    return false;
  }
  return true;
}
