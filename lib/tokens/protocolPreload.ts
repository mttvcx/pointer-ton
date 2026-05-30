import { protocolLogoSrc } from '@/lib/tokens/protocolBrand';

/**
 * Protocol logos safe to warm early (each under ~120KB).
 * Do NOT preload multi-MB PNGs — they were stalling first paint for 30–60s.
 */
export const PULSE_PROTOCOL_PRELOAD_CRITICAL = [
  'pump.fun',
  'bonk',
  'moonshot',
  'meteora',
  'raydium',
  'liquid',
  'jupiter',
  'heaven',
] as const;

/** Warm after idle — still moderate size; never blocks shell. */
export const PULSE_PROTOCOL_PRELOAD_SECONDARY = ['bags'] as const;

/** Known multi-MB assets — on-demand only (row visible / hover). */
const HEAVY_PROTOCOL_IDS = new Set([
  'surge',
  'mayhem',
  'dynamic-bc',
  'jupiter-studio',
  'orca',
  'daos.fun',
  'four.meme',
  'printr',
  'launchlab',
  'moonit',
  'soar',
  'pancakeswap',
  'uniswap',
]);

let warmed = false;

function warmOne(id: string) {
  if (HEAVY_PROTOCOL_IDS.has(id)) return;
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

/** Idempotent — critical logos sync; secondary + rest deferred to idle. */
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
