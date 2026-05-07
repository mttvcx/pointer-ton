'use client';

import { useEffect } from 'react';
import { useUIStore, type EntityKind } from '@/store/ui';

/**
 * Mounts on a detail page and pins the AI Co-pilot to a single entity with
 * source `'route'`. The panel resolves `lockedEntity ?? hoveredEntity`, so a
 * locked detail page always wins until the user navigates away.
 *
 * On unmount we only clear if (a) we still own the slot and (b) the lock is
 * still ours - manual user pins (`source: 'manual'`) survive navigation.
 */
export function EntityLocker({
  type,
  id,
  label,
}: {
  type: EntityKind;
  id: string;
  label?: string | null;
}) {
  useEffect(() => {
    useUIStore.getState().setLocked({ type, id, label: label ?? undefined }, 'route');
    return () => {
      const cur = useUIStore.getState().lockedEntity;
      if (cur && cur.type === type && cur.id === id && cur.source === 'route') {
        useUIStore.getState().setLocked(null);
      }
    };
  }, [type, id, label]);

  return null;
}
