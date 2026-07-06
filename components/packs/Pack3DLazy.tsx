'use client';

import dynamic from 'next/dynamic';
import type { PackType } from '@/types/pack';

/** Lazy 3D pack — WebGL/three.js only loads on demand (never SSR, /packs only). */
const Pack3D = dynamic(() => import('@/components/packs/Pack3D').then((m) => m.Pack3D), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-white/[0.04]" />,
});

export function Pack3DLazy({ type, className }: { type: PackType; className?: string }) {
  return <Pack3D type={type} className={className} />;
}
