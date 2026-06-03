import { protocolLogoSrc } from '@/lib/tokens/protocolBrand';

/** Warm on first Pulse paint — all logos are resized to ≤128px in public/logos/protocols. */
export const PULSE_PROTOCOL_PRELOAD_CRITICAL = [
  'pump.fun',
  'bonk',
  'moonshot',
  'meteora',
  'raydium',
  'liquid',
  'jupiter',
  'heaven',
  'surge',
  'mayhem',
  'orca',
  'bags',
] as const;

/** Warm after idle — remaining Sol launchpads from the filter registry. */
export const PULSE_PROTOCOL_PRELOAD_SECONDARY = [
  'dynamic-bc',
  'jupiter-studio',
  'daos.fun',
  'four.meme',
  'printr',
  'launchlab',
  'moonit',
  'soar',
  'pancakeswap',
] as const;

let warmed = false;

function warmOne(id: string) {
  const img = new window.Image();
  img.decoding = 'async';
  img.src = protocolLogoSrc(id);
}

function scheduleIdle(fn: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(fn, { timeout: 4_000 });
  } else {
    window.setTimeout(fn, 1_500);
  }
}

/** Idempotent — critical logos sync; secondary deferred to idle. */
export function warmPulseProtocolLogos() {
  if (typeof window === 'undefined' || warmed) return;
  warmed = true;

  for (const id of PULSE_PROTOCOL_PRELOAD_CRITICAL) {
    warmOne(id);
  }

  scheduleIdle(() => {
    for (const id of PULSE_PROTOCOL_PRELOAD_SECONDARY) {
      warmOne(id);
    }
  });
}
