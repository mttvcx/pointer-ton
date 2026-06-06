import type { AdminPermission } from '@/lib/admin/permissions';

/** Permission required for Account Guardian freeze/release. */
export const ACCOUNT_CONTROL_PERMISSION = 'account.control' satisfies AdminPermission;

export const ACCOUNT_FREEZE_AUDIT_ACTION = 'account.freeze';
export const ACCOUNT_RELEASE_AUDIT_ACTION = 'account.release';
