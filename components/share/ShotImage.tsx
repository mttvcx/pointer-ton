'use client';

import { useState } from 'react';

/**
 * Product screenshot for the share card. Prefers the real screenshot
 * (/share/terminal.png); falls back to the placeholder until it's added — so
 * dropping public/share/terminal.png "just works" with no code change.
 */
export function ShotImage({ className }: { className?: string }) {
  const [src, setSrc] = useState('/share/terminal.png');
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Pointer terminal"
      className={className}
      onError={() => {
        if (src !== '/share/terminal.svg') setSrc('/share/terminal.svg');
      }}
    />
  );
}
