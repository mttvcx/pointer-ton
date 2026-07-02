/**
 * App-wide font: Sora (Invo vibe). RN 0.81's Text uses the new `component()` syntax
 * (no patchable `.render`) and React 19 ignores `defaultProps`, so the usual global-
 * font hacks silently no-op. Instead we patch the JSX runtime (`jsxDEV`/`jsx`/`jsxs`)
 * + `createElement`: whenever a RN <Text>/<TextInput> element is created, we inject
 * the correct weighted `Sora_*` family FIRST, so the element's own style still wins
 * (Ionicons/SVG text keep their own fontFamily and are untouched).
 *
 * Runs once as a module side effect — import it BEFORE anything renders (App.tsx
 * line 2). Only takes effect on a FULL reload, not a Fast Refresh.
 */
import { StyleSheet, Text, TextInput } from 'react-native';

// Weights mapped ONE NOTCH LIGHTER than requested — the app leans heavily on
// 700/800, which reads as "thick" in Sora. Shifting down keeps hierarchy but gives
// the cleaner, airier Invo feel.
const FAMILY: Record<string, string> = {
  '100': 'Sora_400Regular',
  '200': 'Sora_400Regular',
  '300': 'Sora_400Regular',
  '400': 'Sora_400Regular',
  normal: 'Sora_400Regular',
  '500': 'Sora_400Regular',
  '600': 'Sora_500Medium',
  '700': 'Sora_600SemiBold',
  bold: 'Sora_600SemiBold',
  '800': 'Sora_700Bold',
  '900': 'Sora_700Bold',
};

function familyFor(style: unknown): string {
  const f = (StyleSheet.flatten(style as never) || {}) as { fontWeight?: string | number };
  const w = f.fontWeight != null ? String(f.fontWeight) : '400';
  return FAMILY[w] ?? 'Sora_400Regular';
}

/** Wrap a JSX factory so RN Text/TextInput get a default Sora family injected. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrap(orig: any): any {
  if (!orig || orig.__sora) return orig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapped = function (this: any) {
    // eslint-disable-next-line prefer-rest-params
    const a: any = arguments;
    const type = a[0];
    const props = a[1];
    if ((type === Text || type === TextInput) && props && typeof props === 'object') {
      a[1] = { ...props, style: [{ fontFamily: familyFor(props.style) }, props.style] };
    }
    return orig.apply(this, a);
  };
  wrapped.__sora = true;
  return wrapped;
}

/* eslint-disable @typescript-eslint/no-var-requires */
try {
  const dev = require('react/jsx-dev-runtime');
  if (dev && dev.jsxDEV) dev.jsxDEV = wrap(dev.jsxDEV);
} catch {}
try {
  const rt = require('react/jsx-runtime');
  if (rt && rt.jsx) rt.jsx = wrap(rt.jsx);
  if (rt && rt.jsxs) rt.jsxs = wrap(rt.jsxs);
} catch {}
try {
  const React = require('react');
  if (React && React.createElement) React.createElement = wrap(React.createElement);
} catch {}
