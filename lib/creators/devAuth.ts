import 'server-only';

/** Fixed Discord IDs for local / dev test sessions (not real Discord users). */
export const DEV_CREATOR_DISCORD_ID = 'dev-creator-pointer';
export const DEV_ADMIN_DISCORD_ID = 'dev-admin-pointer';

export function isCreatorDevLoginEnabled(): boolean {
  if (process.env.CREATOR_PORTAL_DEV_LOGIN === '1') return true;
  return process.env.NODE_ENV === 'development';
}

export function assertCreatorDevLoginAllowed(): void {
  if (!isCreatorDevLoginEnabled()) {
    throw new Error('dev_login_disabled');
  }
}
