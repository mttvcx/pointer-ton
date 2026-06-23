'use client';

import dynamic from 'next/dynamic';
import { useUIStore } from '@/store/ui';

// Loaded on demand so the sign-in modal leaves the eager provider chunk —
// only mounted once the user actually opens it (logged-in users never do).
const LandingSignInModal = dynamic(
  () => import('@/components/auth/LandingSignInModal').then((m) => ({ default: m.LandingSignInModal })),
  { ssr: false },
);

/** App-wide Pointer sign-in overlay — Google/X open in a popup, not a full-page redirect. */
export function PointerSignInHost() {
  const open = useUIStore((s) => s.signInModalOpen);
  const setOpen = useUIStore((s) => s.setSignInModalOpen);
  if (!open) return null;
  return <LandingSignInModal open={open} onClose={() => setOpen(false)} />;
}
