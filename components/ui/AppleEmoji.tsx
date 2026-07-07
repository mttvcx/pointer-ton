'use client';

import { createElement } from 'react';
import data from '@emoji-mart/data';
import { init } from 'emoji-mart';

/**
 * Renders an emoji as the FULL Apple / iOS glyph (image sprite) instead of the
 * host OS font — so Windows/Android users see the same rich emoji as iOS, not the
 * flat system set. Backed by emoji-mart's `<em-emoji>` custom element; falls back
 * to the native character until the sprite loads (or if it's an unknown glyph).
 *
 * Store emojis as their native unicode character (back-compat with existing
 * labels); this component upgrades the *rendering* to Apple everywhere it's shown.
 */

let initialized = false;
function ensureInit() {
  if (initialized) return;
  initialized = true;
  void init({ data });
}

export function AppleEmoji({
  emoji,
  size = '1.1em',
  className,
}: {
  emoji: string;
  size?: string | number;
  className?: string;
}) {
  ensureInit();
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1 }} aria-hidden={false}>
      {createElement('em-emoji', {
        native: emoji,
        set: 'apple',
        size: typeof size === 'number' ? `${size}px` : size,
        fallback: emoji,
      })}
    </span>
  );
}
