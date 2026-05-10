'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LS_SHARE_SETTINGS } from '@/lib/share/sharePersistenceKeys';
import type {
  ShareBackgroundPresetId,
  ShareMode,
  ShareOverlaySettings,
} from '@/lib/share/types';
import { DEFAULT_SHARE_OVERLAY } from '@/lib/share/types';

type PersistedJson = {
  mode: ShareMode;
  backgroundId: ShareBackgroundPresetId;
  chainTicker: string;
  overlay: ShareOverlaySettings;
  /** Normalized drag offset for custom image */
  imagePan: { x: number; y: number };
  imageZoom: number;
};

const DEFAULT_PERSISTED: PersistedJson = {
  mode: 'image',
  backgroundId: 'dark-glass',
  chainTicker: 'SOL',
  overlay: DEFAULT_SHARE_OVERLAY,
  imagePan: { x: 0, y: 0 },
  imageZoom: 1,
};

function loadPersisted(): PersistedJson {
  if (typeof window === 'undefined') return DEFAULT_PERSISTED;
  try {
    const raw = localStorage.getItem(LS_SHARE_SETTINGS);
    if (!raw) return DEFAULT_PERSISTED;
    const j = JSON.parse(raw) as Partial<PersistedJson>;
    return {
      ...DEFAULT_PERSISTED,
      ...j,
      overlay: { ...DEFAULT_SHARE_OVERLAY, ...j.overlay },
      imagePan: j.imagePan ?? DEFAULT_PERSISTED.imagePan,
      imageZoom: typeof j.imageZoom === 'number' ? j.imageZoom : 1,
    };
  } catch {
    return DEFAULT_PERSISTED;
  }
}

function savePersisted(p: PersistedJson) {
  try {
    localStorage.setItem(LS_SHARE_SETTINGS, JSON.stringify(p));
  } catch {
    /* quota */
  }
}

export function useShareComposerState() {
  const initial = useMemo(() => loadPersisted(), []);
  const [mode, setMode] = useState<ShareMode>(initial.mode);
  const [backgroundId, setBackgroundId] = useState<ShareBackgroundPresetId>(initial.backgroundId);
  const [chainTicker, setChainTicker] = useState(initial.chainTicker);
  const [overlay, setOverlay] = useState<ShareOverlaySettings>(initial.overlay);
  const [imagePan, setImagePan] = useState(initial.imagePan);
  const [imageZoom, setImageZoom] = useState(initial.imageZoom);

  const persistSlice = useCallback((): PersistedJson => {
    return {
      mode,
      backgroundId,
      chainTicker,
      overlay,
      imagePan,
      imageZoom,
    };
  }, [mode, backgroundId, chainTicker, overlay, imagePan, imageZoom]);

  useEffect(() => {
    savePersisted(persistSlice());
  }, [persistSlice]);

  const resetDefaults = useCallback(() => {
    setOverlay(DEFAULT_SHARE_OVERLAY);
    setBackgroundId('dark-glass');
    setImagePan({ x: 0, y: 0 });
    setImageZoom(1);
  }, []);

  return {
    mode,
    setMode,
    backgroundId,
    setBackgroundId,
    chainTicker,
    setChainTicker,
    overlay,
    setOverlay,
    patchOverlay: (p: Partial<ShareOverlaySettings>) =>
      setOverlay((o) => ({ ...o, ...p })),
    imagePan,
    setImagePan,
    imageZoom,
    setImageZoom,
    resetDefaults,
  };
}
