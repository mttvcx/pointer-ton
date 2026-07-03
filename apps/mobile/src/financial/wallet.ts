/**
 * Add-to-Apple-Pay (PassKit push provisioning).
 *
 * Real provisioning needs three things that land later:
 *   1. a native PassKit provisioning module (added when we pick the issuer SDK),
 *   2. the `com.apple.developer.payment-pass-provisioning` entitlement (Apple must
 *      approve it for our account), and
 *   3. the encrypted card payload from the issuer, served by
 *      `POST /api/financial/card/provision`.
 *
 * Until all three exist, `walletAvailable()` is false and `addToApplePay()`
 * reports an honest reason. In DEMO we simulate a success so the flow is
 * demoable end-to-end.
 */
import { DEMO } from '../auth';
import { provisionCard } from './api';

// Lazy-require the native provisioning module so the app builds without it.
let nativeProvisioner: { addPass: (payload: unknown) => Promise<void> } | null = null;
try {
  // Wire the real module name here once chosen (e.g. a PassKit provisioning lib).
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-unresolved
  nativeProvisioner = null;
} catch {
  nativeProvisioner = null;
}

export function walletAvailable(): boolean {
  // Flip to `nativeProvisioner != null` once the module + entitlement are in.
  return false;
}

export type AddToWalletResult = { ok: boolean; simulated?: boolean; reason?: 'not-configured' | 'entitlement-pending' | 'error' };

export async function addToApplePay(): Promise<AddToWalletResult> {
  if (DEMO) return { ok: true, simulated: true };
  try {
    const r = await provisionCard();
    if (!r.configured || !r.provisioning) return { ok: false, reason: 'not-configured' };
    if (!nativeProvisioner) return { ok: false, reason: 'entitlement-pending' };
    await nativeProvisioner.addPass(r.provisioning.payload);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
