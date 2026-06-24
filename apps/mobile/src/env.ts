import Constants from 'expo-constants';

type Extra = { apiUrl: string; privyAppId: string; privyClientId: string };

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

/** Base URL of the existing Pointer Next.js API (the mobile app is a client to it). */
export const API_URL = (extra.apiUrl ?? 'https://pointer-ton.vercel.app').replace(/\/$/, '');

/** Same Privy App ID as the web app → unified identity + embedded wallet. */
export const PRIVY_APP_ID = extra.privyAppId ?? '';

/** Privy "Expo app client" id (create one in the Privy dashboard — see README). */
export const PRIVY_CLIENT_ID = extra.privyClientId ?? '';
