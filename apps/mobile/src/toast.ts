/** Tiny app-level toast — imperative showToast() from anywhere, one at a time. */
import { useSyncExternalStore } from 'react';

export type ToastKind = 'success' | 'info' | 'error';
export type ToastData = { id: number; message: string; sub?: string; kind: ToastKind };

let current: ToastData | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(message: string, opts?: { sub?: string; kind?: ToastKind }) {
  current = { id: ++seq, message, sub: opts?.sub, kind: opts?.kind ?? 'success' };
  emit();
}
export function clearToast() {
  current = null;
  emit();
}
export const useToast = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
