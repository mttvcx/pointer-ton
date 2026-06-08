'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LS_SHARE_SETTINGS } from '@/lib/share/sharePersistenceKeys';
import type { ShareBackgroundPresetId, ShareMode, ShareOverlaySettings } from '@/lib/share/types';
import { DEFAULT_SHARE_OVERLAY, normalizeShareOverlay } from '@/lib/share/types';
import { DEFAULT_BACKGROUND_ID, PRESET_BACKGROUNDS } from '@/lib/share/backgrounds';

const VALID_BACKGROUND_IDS = new Set<ShareBackgroundPresetId>(
  PRESET_BACKGROUNDS.map((p) => p.id),
);

function normalizeBackground(value: unknown): ShareBackgroundPresetId {
  if (typeof value === 'string' && VALID_BACKGROUND_IDS.has(value as ShareBackgroundPresetId)) {
    return value as ShareBackgroundPresetId;
  }
  return DEFAULT_BACKGROUND_ID;
}

type PersistedJson = {
  mode: ShareMode;
  backgroundId: ShareBackgroundPresetId;
  chainTicker: string;
  overlay: ShareOverlaySettings;
  imagePan: { x: number; y: number };
  imageZoom: number;
  videoPan: { x: number; y: number };
  videoZoom: number;
};

const DEFAULT_PERSISTED: PersistedJson = {
  mode: 'image',
  backgroundId: DEFAULT_BACKGROUND_ID,
  chainTicker: 'SOL',
  overlay: DEFAULT_SHARE_OVERLAY,
  imagePan: { x: 0, y: 0 },
  imageZoom: 1,
  videoPan: { x: 0, y: 0 },
  videoZoom: 1,
};

function loadPersisted(): PersistedJson {
  if (typeof window === 'undefined') return DEFAULT_PERSISTED;
  try {
    const raw = localStorage.getItem(LS_SHARE_SETTINGS);
    if (!raw) return DEFAULT_PERSISTED;
    const j = JSON.parse(raw) as Partial<PersistedJson> & { headlineText?: string };
    return {
      ...DEFAULT_PERSISTED,
      ...j,
      backgroundId: normalizeBackground(j.backgroundId),
      overlay: normalizeShareOverlay(j.overlay),
      imagePan: j.imagePan ?? DEFAULT_PERSISTED.imagePan,
      imageZoom: typeof j.imageZoom === 'number' ? j.imageZoom : 1,
      videoPan: j.videoPan ?? DEFAULT_PERSISTED.videoPan,
      videoZoom: typeof j.videoZoom === 'number' ? j.videoZoom : 1,
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
  const [videoPan, setVideoPan] = useState(initial.videoPan);
  const [videoZoom, setVideoZoom] = useState(initial.videoZoom);

  const persistSlice = useCallback((): PersistedJson => {
    return {
      mode,
      backgroundId,
      chainTicker,
      overlay,
      imagePan,
      imageZoom,
      videoPan,
      videoZoom,
    };
  }, [mode, backgroundId, chainTicker, overlay, imagePan, imageZoom, videoPan, videoZoom]);

  useEffect(() => {
    savePersisted(persistSlice());
  }, [persistSlice]);

  const resetDefaults = useCallback(() => {
    setOverlay(DEFAULT_SHARE_OVERLAY);
    setBackgroundId(DEFAULT_BACKGROUND_ID);
    setImagePan({ x: 0, y: 0 });
    setImageZoom(1);
    setVideoPan({ x: 0, y: 0 });
    setVideoZoom(1);
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
    videoPan,
    setVideoPan,
    videoZoom,
    setVideoZoom,
    resetDefaults,
  };
}
