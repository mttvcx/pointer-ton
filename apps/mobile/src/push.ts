import { Platform } from 'react-native';
import { authToken } from './auth';
import { api } from './api/client';

/**
 * Expo push registration. Requests permission, gets the device's Expo push token,
 * and registers it with the backend (`POST /api/push/register`) so follows/friends
 * can notify you. The native `expo-notifications` module only exists in a full EAS
 * build — everything here is guarded so it's a silent no-op on the current OTA
 * build (and in Expo Go, where remote push isn't supported) until the next
 * `eas build` includes it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Notifications: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

const EAS_PROJECT_ID = '782edf66-e786-4d79-9522-bddbba8f4c19';

export async function registerForPush(): Promise<void> {
  if (!Notifications) return;
  try {
    let status = (await Notifications.getPermissionsAsync()).status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    const resp = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    const expoPushToken: string | undefined = resp?.data;
    if (!expoPushToken) return;

    await api('/api/push/register', {
      token: await authToken(),
      method: 'POST',
      body: { expoPushToken, platform: Platform.OS === 'android' ? 'android' : 'ios' },
    });
  } catch {
    // native module absent (pre-rebuild), Expo Go, or permission denied — no-op
  }
}
