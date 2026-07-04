'use client';

import { create } from 'zustand';

/**
 * X Monitor "Preview samples" toggle — lifted to a store so it can be toggled
 * from a small control beside the Pulse/Stocks tabs while the XMonitorPanel reads
 * the same state. Per-session (not persisted); client-side demo only.
 */
type XMonitorPreviewState = {
  preview: boolean;
  setPreview: (v: boolean) => void;
  toggle: () => void;
};

export const useXMonitorPreviewStore = create<XMonitorPreviewState>((set) => ({
  preview: false,
  setPreview: (preview) => set({ preview }),
  toggle: () => set((s) => ({ preview: !s.preview })),
}));
