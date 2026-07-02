import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Drop-in glass fill for pills/squares/cards — a translucent tint (so the app's
 * gradient shows through) + a top hairline highlight. The PARENT must set
 * `overflow: 'hidden'` and a borderRadius. `active` = the island-style SELECTOR
 * highlight (brighter), our replacement for a green selected-outline.
 *
 * PERF: this deliberately does NOT use a live BlurView. Over the dark mint
 * gradient a real blur is barely perceptible but very GPU-heavy, and there are
 * dozens of these on screen (chips, cards, presets, rows). A translucent fill +
 * hairline reads as the same frosted glass for ~free. Live blur is reserved for
 * the few surfaces where content actually scrolls behind (the home header, the
 * nav island).
 */
export function GlassFill({ active = false }: { active?: boolean }) {
  return (
    <>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'rgba(18,21,26,0.62)' }]}
      />
      <View pointerEvents="none" style={[s.hairline, { backgroundColor: active ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.12)' }]} />
    </>
  );
}

const s = StyleSheet.create({
  hairline: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
});
