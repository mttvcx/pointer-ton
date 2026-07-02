import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * Drop-in liquid-glass fill for pills/squares — frosted blur + tint + top hairline,
 * matching the nav island's glass. The PARENT must set `overflow: 'hidden'` and a
 * borderRadius. `active` renders the island-style SELECTOR highlight (brighter
 * glass) — our replacement for a green selected-outline.
 */
export function GlassFill({ active = false }: { active?: boolean }) {
  return (
    <>
      <BlurView intensity={active ? 36 : 16} tint="dark" style={StyleSheet.absoluteFill} />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: active ? 'rgba(255,255,255,0.13)' : 'rgba(12,18,20,0.4)' }]}
      />
      <View pointerEvents="none" style={[s.hairline, { backgroundColor: active ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)' }]} />
    </>
  );
}

const s = StyleSheet.create({
  hairline: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
});
