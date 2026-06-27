import * as Clipboard from 'expo-clipboard';

/**
 * Best-effort copy to the system clipboard. Never throws — returns whether the
 * write succeeded so callers can show confirmation/feedback. We COPY contract
 * addresses / token names here; the mobile app never opens Solscan.
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(value);
    return true;
  } catch {
    return false;
  }
}
