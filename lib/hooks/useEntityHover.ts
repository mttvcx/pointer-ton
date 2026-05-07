'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useUIStore, type EntityRef } from '@/store/ui';

const LEAVE_GRACE_MS = 120;

/**
 * Shared hover handlers that drive `useUIStore.hoveredEntity` for any entity
 * row (token / wallet). 120 ms grace on leave so brief mouse jitter between
 * adjacent rows or in/out of nested elements doesn't unset the panel target.
 *
 * Returns mouse + keyboard handlers. Spread the returned object onto the row
 * wrapper:
 *
 *     const hoverProps = useEntityHover({ type: 'wallet', id: address });
 *     <div {...hoverProps}>...</div>
 *
 * Pass `null` to disable (e.g. row without a useful entity ref). The store's
 * own idempotency check prevents redundant updates on rapid mouse movement.
 */
export function useEntityHover(entity: EntityRef | null) {
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = Boolean(entity);
  const setHovered = useUIStore((s) => s.setHovered);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const enter = useCallback(() => {
    if (!entity) return;
    clearLeaveTimer();
    setHovered(entity);
  }, [entity, clearLeaveTimer, setHovered]);

  const leave = useCallback(() => {
    if (!entity) return;
    clearLeaveTimer();
    leaveTimer.current = setTimeout(() => {
      // Only clear if we still own the slot (another row may have taken over
      // during the grace window). Compare by id to keep this cheap.
      const current = useUIStore.getState().hoveredEntity;
      if (current && current.type === entity.type && current.id === entity.id) {
        setHovered(null);
      }
    }, LEAVE_GRACE_MS);
  }, [entity, clearLeaveTimer, setHovered]);

  // Cancel any pending leave on unmount so a torn-down row doesn't briefly
  // null out the hovered entity after the user has moved on.
  useEffect(() => {
    return clearLeaveTimer;
  }, [clearLeaveTimer]);

  if (!enabled) {
    return {} as const;
  }

  return {
    onMouseEnter: enter,
    onMouseLeave: leave,
    onFocus: enter,
    onBlur: leave,
  } as const;
}
