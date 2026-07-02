/**
 * App-wide font: Sora (Invo-style clean/serious grotesque). RN doesn't map
 * fontWeight → a weighted family for custom fonts, so we patch Text/TextInput to
 * inject the correct `Sora_*` family based on each element's fontWeight. Explicit
 * fontFamily in a style still wins (Ionicons etc. untouched) because our injected
 * family is placed FIRST and the element's own style overrides it.
 *
 * Two strategies for robustness: patch the forwardRef `.render` (weight-aware);
 * if that isn't available on this RN build, fall back to a default `Sora_400Regular`
 * base style via defaultProps. Imported once, early in App.tsx.
 *
 * NOTE: this runs as a module side effect at load — it only takes effect on a FULL
 * app reload, not a Fast Refresh. Fully quit + reopen Expo Go after changing it.
 */
import { StyleSheet, Text, TextInput } from 'react-native';

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

type Patchable = {
  render?: (props: unknown, ref: unknown) => unknown;
  defaultProps?: { style?: unknown };
  __soraPatched?: boolean;
};

function apply(Comp: unknown) {
  const c = Comp as Patchable;
  if (!c || c.__soraPatched) return;
  if (typeof c.render === 'function') {
    const orig = c.render;
    c.render = function (props: unknown, ref: unknown) {
      const p = (props ?? {}) as { style?: unknown };
      return orig.call(this, { ...p, style: [{ fontFamily: familyFor(p.style) }, p.style] }, ref);
    };
  } else {
    // Fallback: at least default everything to Sora regular (weights won't map).
    const base = c.defaultProps?.style;
    c.defaultProps = { ...(c.defaultProps ?? {}), style: base ? [{ fontFamily: 'Sora_400Regular' }, base] : { fontFamily: 'Sora_400Regular' } };
  }
  c.__soraPatched = true;
}

apply(Text);
apply(TextInput);
