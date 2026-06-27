import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../src/theme';

/**
 * Universal multi-snap pull-up sheet.
 *
 * Drag the grabber (or anywhere in the handle row) UP to expand toward full
 * screen, DOWN to collapse, and DOWN past the lowest snap to dismiss. Release
 * velocity is taken into account (flick up expands, flick down dismisses).
 * Tapping the scrim still closes.
 *
 * API is backward compatible with the original two-state sheet:
 *   <DragSheet visible={bool} onClose={() => void}>{children}</DragSheet>
 * Optional multi-snap controls:
 *   snapPoints  — fractions of screen height (0..1), ascending. default [0.6, 0.92]
 *   initialSnap — index into snapPoints. default 0
 */

type DragSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Fractions of screen height (0..1), ascending. e.g. [0.55, 0.92]. */
  snapPoints?: number[];
  /** Index into snapPoints to open at. */
  initialSnap?: number;
};

const DEFAULT_SNAPS = [0.6, 0.92];
const DISMISS_DRAG = 90; // px past the lowest snap to drag-dismiss
const DISMISS_VELOCITY = 0.9; // downward flick velocity to dismiss
const FLICK_VELOCITY = 0.5; // velocity to count a release as a flick

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function DragSheet({ visible, onClose, children, snapPoints, initialSnap = 0 }: DragSheetProps) {
  const insets = useSafeAreaInsets();
  const [screenH, setScreenH] = useState(() => Dimensions.get('window').height);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenH(window.height));
    return () => sub.remove();
  }, []);

  // Normalize + sanitize snap fractions into ascending, in-range heights (px).
  const heights = useMemo(() => {
    const raw = snapPoints && snapPoints.length ? snapPoints : DEFAULT_SNAPS;
    const fracs = raw
      .map((f) => clamp(f, 0.2, 0.98))
      .filter((f) => Number.isFinite(f))
      .sort((a, b) => a - b);
    const safe = fracs.length ? fracs : DEFAULT_SNAPS;
    return safe.map((f) => Math.round(f * screenH));
  }, [snapPoints, screenH]);

  const maxHeight = heights[heights.length - 1] ?? Math.round(screenH * 0.92);
  // translateY offsets from the fully-open position for each snap (>= 0).
  // Higher snap (taller) -> smaller offset; lowest snap -> largest offset.
  const offsets = useMemo(() => heights.map((h) => maxHeight - h), [heights, maxHeight]);

  const startIndex = clamp(initialSnap, 0, Math.max(0, offsets.length - 1));

  // translateY of the panel. Starts fully off-screen.
  const ty = useRef(new Animated.Value(screenH)).current;
  // Current resting offset (so drags are relative to where we are).
  const restOffset = useRef(offsets[startIndex] ?? 0);
  const snapIndex = useRef(startIndex);

  const animateTo = useCallback(
    (offset: number) => {
      restOffset.current = offset;
      Animated.spring(ty, {
        toValue: offset,
        useNativeDriver: true,
        speed: 16,
        bounciness: 3,
      }).start();
    },
    [ty],
  );

  const close = useCallback(() => {
    Animated.timing(ty, { toValue: maxHeight + screenH * 0.3 + 200, duration: 220, useNativeDriver: true }).start(() => {
      onClose();
    });
  }, [ty, maxHeight, screenH, onClose]);

  // Open / close lifecycle: mount, then spring up; on hide, animate out then unmount.
  useEffect(() => {
    if (visible) {
      setMounted(true);
    } else if (mounted) {
      Animated.timing(ty, { toValue: maxHeight + screenH * 0.3 + 200, duration: 200, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setMounted(false);
        },
      );
    }
  }, [visible, mounted, ty, maxHeight, screenH]);

  // When freshly mounted, settle to the initial snap with a spring-in.
  useEffect(() => {
    if (mounted && visible) {
      const idx = clamp(initialSnap, 0, Math.max(0, offsets.length - 1));
      snapIndex.current = idx;
      const target = offsets[idx] ?? 0;
      restOffset.current = target;
      ty.setValue(maxHeight + screenH * 0.3 + 200);
      Animated.spring(ty, { toValue: target, useNativeDriver: true, speed: 14, bounciness: 2 }).start();
    }
    // Re-run only when we transition into a mounted+visible state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, visible]);

  // Snap to the nearest target given current offset + release velocity.
  const settle = useCallback(
    (currentOffset: number, vy: number) => {
      const lowestOffset = offsets[0] ?? 0; // largest offset = shortest sheet
      const minOffset = offsets[offsets.length - 1] ?? 0; // 0 = tallest

      // Drag-to-dismiss: dragged below the lowest snap past threshold, or flicked down hard.
      if (currentOffset > lowestOffset + DISMISS_DRAG || (vy > DISMISS_VELOCITY && currentOffset >= lowestOffset - 4)) {
        close();
        return;
      }

      // Velocity-driven snapping (flicks jump one neighbor in the flick direction).
      let target = currentOffset;
      if (vy < -FLICK_VELOCITY) {
        // flick up -> next taller snap
        let idx = offsets.length - 1;
        for (let i = 0; i < offsets.length; i++) {
          const o = offsets[i] ?? 0;
          if (o < currentOffset - 1) {
            idx = i;
            break;
          }
        }
        target = offsets[idx] ?? minOffset;
        snapIndex.current = idx;
      } else if (vy > FLICK_VELOCITY) {
        // flick down -> next shorter snap
        let idx = 0;
        for (let i = offsets.length - 1; i >= 0; i--) {
          const o = offsets[i] ?? 0;
          if (o > currentOffset + 1) {
            idx = i;
            break;
          }
        }
        target = offsets[idx] ?? lowestOffset;
        snapIndex.current = idx;
      } else {
        // Slow release -> nearest snap (midpoint logic falls out of "closest").
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < offsets.length; i++) {
          const o = offsets[i] ?? 0;
          const d = Math.abs(o - currentOffset);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        target = offsets[bestIdx] ?? minOffset;
        snapIndex.current = bestIdx;
      }

      animateTo(clamp(target, minOffset, lowestOffset));
    },
    [offsets, animateTo, close],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          const minOffset = offsets[offsets.length - 1] ?? 0;
          let next = restOffset.current + g.dy;
          // Apply gentle rubber-banding above the tallest snap (resist over-expand).
          if (next < minOffset) next = minOffset + (next - minOffset) * 0.35;
          ty.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          settle(restOffset.current + g.dy, g.vy);
        },
        onPanResponderTerminate: (_, g) => {
          settle(restOffset.current + g.dy, g.vy);
        },
      }),
    [offsets, ty, settle],
  );

  // Keep restOffset valid if snap geometry changes while open (e.g. rotation).
  useEffect(() => {
    if (!mounted) return;
    const idx = clamp(snapIndex.current, 0, Math.max(0, offsets.length - 1));
    const target = offsets[idx] ?? 0;
    restOffset.current = target;
    ty.setValue(target);
  }, [offsets, mounted, ty]);

  const onModalLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h && Math.abs(h - screenH) > 1) setScreenH(h);
  };

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill} onLayout={onModalLayout}>
        <Pressable style={s.scrim} onPress={close} />
        <Animated.View
          style={[
            s.sheet,
            {
              height: maxHeight,
              transform: [{ translateY: ty }],
              paddingBottom: insets.bottom + 14,
            },
          ]}
        >
          <View {...pan.panHandlers} style={s.grab}>
            <View style={s.handle} />
          </View>
          <View style={s.content}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  grab: { alignItems: 'center', paddingTop: 12, paddingBottom: 16 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong },
  content: { flex: 1 },
});
