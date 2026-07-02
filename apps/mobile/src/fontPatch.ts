/**
 * App-wide font: Sora (Invo-style clean/serious grotesque). RN doesn't map
 * fontWeight → a weighted family for custom fonts, so we patch Text/TextInput to
 * inject the correct `Sora_*` family based on each element's fontWeight. Explicit
 * fontFamily in a style still wins (Ionicons etc. are untouched) because our
 * injected family is placed FIRST and the element's own style overrides it.
 *
 * Imported for its side effect once, early in App.tsx (before anything renders).
 */
import { StyleSheet, Text, TextInput } from 'react-native';

// Only the 5 weights loaded in App.tsx; lighter/heavier map to the nearest loaded.
const FAMILY: Record<string, string> = {
  '100': 'Sora_400Regular',
  '200': 'Sora_400Regular',
  '300': 'Sora_400Regular',
  '400': 'Sora_400Regular',
  normal: 'Sora_400Regular',
  '500': 'Sora_500Medium',
  '600': 'Sora_600SemiBold',
  '700': 'Sora_700Bold',
  bold: 'Sora_700Bold',
  '800': 'Sora_800ExtraBold',
  '900': 'Sora_800ExtraBold',
};

function familyFor(style: unknown): string {
  const f = (StyleSheet.flatten(style as never) || {}) as { fontWeight?: string | number };
  const w = f.fontWeight != null ? String(f.fontWeight) : '400';
  return FAMILY[w] ?? 'Sora_400Regular';
}

function patch(Comp: unknown) {
  const c = Comp as { render?: (props: unknown, ref: unknown) => unknown; __soraPatched?: boolean };
  if (!c || typeof c.render !== 'function' || c.__soraPatched) return;
  const orig = c.render;
  c.render = function (props: unknown, ref: unknown) {
    const p = (props ?? {}) as { style?: unknown };
    const merged = [{ fontFamily: familyFor(p.style) }, p.style];
    return orig.call(this, { ...p, style: merged }, ref);
  };
  c.__soraPatched = true;
}

patch(Text);
patch(TextInput);
