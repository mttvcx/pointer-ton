import * as SecureStore from 'expo-secure-store';

/**
 * Remembers whether an account has finished onboarding, so a returning user goes
 * login → straight to the app (not through Connect X / username every launch).
 * Keyed per account (embedded wallet address) so a NEW sign-in still onboards.
 * Backed by expo-secure-store, which Privy already uses for its session — so it's
 * present in the native build. Never throws into the UI.
 */
const key = (id: string) => `pointer.onboarded.${id}`;

export async function isOnboarded(id: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(key(id))) === '1';
  } catch {
    return false;
  }
}

export async function markOnboarded(id: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key(id), '1');
  } catch {
    // best-effort — worst case they see onboarding again
  }
}
