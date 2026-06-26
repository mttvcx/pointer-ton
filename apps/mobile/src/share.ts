import { Share } from 'react-native';

/** Opens the native iOS/Android share sheet. No-op if the user cancels. */
export async function shareText(message: string, url?: string) {
  try {
    await Share.share(url ? { message, url } : { message });
  } catch {
    // user dismissed — ignore
  }
}
