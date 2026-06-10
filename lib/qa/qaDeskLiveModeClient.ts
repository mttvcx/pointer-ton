import { isPointerQaMintClient } from '@/lib/qa/pointerQaMintClient';

/** Client gate — mirrors server QA desk live mode. */
export function isQaDeskLiveModeClient(mint: string | null | undefined): boolean {
  return isPointerQaMintClient(mint);
}
