import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import { unionPermissions } from '@/lib/admin/permissions';
import type { Json, Tables } from '@/lib/supabase/types';

export type AdminUserRow = Tables<'admin_users'>;
export type AdminRoleRow = Tables<'admin_roles'>;
export type AdminAuditRow = Tables<'admin_audit_log'>;

export type AdminContext = {
  adminUserId: string;
  userId: string;
  walletAddress: string | null;
  username: string | null;
  email: string | null;
  isActive: boolean;
  roles: { key: string; name: string }[];
  permissions: string[];
};

const ADMIN_CACHE_MS = 60_000;
const adminCache = new Map<string, { ctx: AdminContext | null; at: number }>();

/** Invalidate a cached admin resolution (call after role/membership writes). */
export function invalidateAdminCache(userId?: string) {
  if (userId) adminCache.delete(userId);
  else adminCache.clear();
}

/** Lightweight: is this user an active admin? (For the extension auto-applying an
 *  admin's own labels without waiting for crowdsource agreement.) */
export async function isActiveAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data } = await createAdminSupabase()
      .from('admin_users')
      .select('is_active')
      .eq('user_id', userId)
      .maybeSingle();
    return !!data?.is_active;
  } catch {
    return false;
  }
}

/**
 * Resolve a Privy `users.id` to an active admin context (roles + effective
 * permissions). Returns null when the user is not an admin or is deactivated.
 * Auto-bootstraps a superadmin row when the user's wallet is listed in
 * ADMIN_BOOTSTRAP_WALLETS or email in ADMIN_BOOTSTRAP_EMAILS (Gmail/email
 * Privy logins — most users never connect an external wallet first).
 */
export async function resolveAdminContext(
  userId: string,
  walletAddress: string | null,
  username: string | null,
  email: string | null = null,
): Promise<AdminContext | null> {
  const cached = adminCache.get(userId);
  if (cached && Date.now() - cached.at < ADMIN_CACHE_MS) return cached.ctx;

  const supabase = createAdminSupabase();

  let { data: adminRow } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // Bootstrap path: founder wallet or email becomes superadmin on first sign-in.
  if (!adminRow && (isBootstrapWallet(walletAddress) || isBootstrapEmail(email))) {
    adminRow = await bootstrapSuperadmin(userId);
  }

  if (!adminRow || !adminRow.is_active) {
    adminCache.set(userId, { ctx: null, at: Date.now() });
    return null;
  }

  const { data: roleLinks } = await supabase
    .from('admin_user_roles')
    .select('role_id')
    .eq('admin_user_id', adminRow.id);

  const roleIds = (roleLinks ?? []).map((r) => r.role_id);
  let roles: AdminRoleRow[] = [];
  if (roleIds.length > 0) {
    const { data: roleRows } = await supabase
      .from('admin_roles')
      .select('*')
      .in('id', roleIds);
    roles = roleRows ?? [];
  }

  const ctx: AdminContext = {
    adminUserId: adminRow.id,
    userId,
    walletAddress,
    username,
    email: email?.trim() || null,
    isActive: adminRow.is_active,
    roles: roles.map((r) => ({ key: r.key, name: r.name })),
    permissions: unionPermissions(roles.map((r) => r.permissions ?? [])),
  };
  adminCache.set(userId, { ctx, at: Date.now() });
  return ctx;
}

function parseBootstrapList(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isBootstrapWallet(walletAddress: string | null): boolean {
  const allowed = parseBootstrapList(process.env.ADMIN_BOOTSTRAP_WALLETS);
  if (allowed.size === 0 || !walletAddress?.trim()) return false;
  return allowed.has(walletAddress.trim().toLowerCase());
}

function isBootstrapEmail(email: string | null): boolean {
  const allowed = parseBootstrapList(process.env.ADMIN_BOOTSTRAP_EMAILS);
  if (allowed.size === 0 || !email?.trim()) return false;
  return allowed.has(email.trim().toLowerCase());
}

async function bootstrapSuperadmin(userId: string): Promise<AdminUserRow | null> {
  const supabase = createAdminSupabase();
  const { data: created, error } = await supabase
    .from('admin_users')
    .insert({ user_id: userId, is_active: true, notes: 'bootstrap' })
    .select('*')
    .single();
  if (error || !created) return null;

  const { data: role } = await supabase
    .from('admin_roles')
    .select('id')
    .eq('key', 'superadmin')
    .maybeSingle();
  if (role) {
    await supabase
      .from('admin_user_roles')
      .insert({ admin_user_id: created.id, role_id: role.id })
      .select('admin_user_id');
  }
  return created;
}

/* ------------------------------ audit log ------------------------------- */

export type AdminAuditInput = {
  ctx: AdminContext | { actorLabel: string; adminUserId?: string | null };
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  before?: Json | null;
  after?: Json | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

/** Write one audit row. Every admin mutation must call this. */
export async function logAdminAction(input: AdminAuditInput): Promise<void> {
  const supabase = createAdminSupabase();
  const ctx = input.ctx;
  const adminUserId = 'adminUserId' in ctx ? ctx.adminUserId : (ctx.adminUserId ?? null);
  const actorLabel =
    'walletAddress' in ctx
      ? ctx.username || ctx.walletAddress || ctx.userId
      : ctx.actorLabel;

  const { error } = await supabase.from('admin_audit_log').insert({
    admin_user_id: adminUserId ?? null,
    actor_label: actorLabel,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    reason: input.reason ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: (input.metadata ?? {}) as Json,
    ip: input.ip ?? null,
  });
  if (error) throw new Error(`logAdminAction failed: ${error.message}`);
}

export async function listAuditLog(opts: {
  limit?: number;
  action?: string;
  targetType?: string;
  adminUserId?: string;
} = {}): Promise<AdminAuditRow[]> {
  const supabase = createAdminSupabase();
  let q = supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false });
  if (opts.action) q = q.eq('action', opts.action);
  if (opts.targetType) q = q.eq('target_type', opts.targetType);
  if (opts.adminUserId) q = q.eq('admin_user_id', opts.adminUserId);
  q = q.limit(Math.min(500, Math.max(1, opts.limit ?? 100)));
  const { data, error } = await q;
  if (error) throw new Error(`listAuditLog failed: ${error.message}`);
  return data ?? [];
}

/* ------------------------------ admin mgmt ------------------------------ */

export async function listAdminUsers(): Promise<
  (AdminUserRow & { roles: string[] })[]
> {
  const supabase = createAdminSupabase();
  const { data: admins, error } = await supabase.from('admin_users').select('*');
  if (error) throw new Error(`listAdminUsers failed: ${error.message}`);
  if (!admins || admins.length === 0) return [];

  const { data: links } = await supabase.from('admin_user_roles').select('admin_user_id, role_id');
  const { data: roles } = await supabase.from('admin_roles').select('id, key');
  const roleKeyById = new Map((roles ?? []).map((r) => [r.id, r.key]));

  return admins.map((a) => ({
    ...a,
    roles: (links ?? [])
      .filter((l) => l.admin_user_id === a.id)
      .map((l) => roleKeyById.get(l.role_id))
      .filter((k): k is string => Boolean(k)),
  }));
}

export async function listAdminRoles(): Promise<AdminRoleRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from('admin_roles').select('*').order('key');
  if (error) throw new Error(`listAdminRoles failed: ${error.message}`);
  return data ?? [];
}

export async function grantAdminRole(input: {
  targetUserId: string;
  roleKey: string;
  grantedByUserId: string;
}): Promise<void> {
  const supabase = createAdminSupabase();
  let { data: admin } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', input.targetUserId)
    .maybeSingle();
  if (!admin) {
    const { data: created, error } = await supabase
      .from('admin_users')
      .insert({ user_id: input.targetUserId, is_active: true, created_by: input.grantedByUserId })
      .select('*')
      .single();
    if (error || !created) throw new Error(`create admin_user failed: ${error?.message}`);
    admin = created;
  }
  const { data: role } = await supabase
    .from('admin_roles')
    .select('id')
    .eq('key', input.roleKey)
    .maybeSingle();
  if (!role) throw new Error(`unknown role: ${input.roleKey}`);

  const { error: linkErr } = await supabase
    .from('admin_user_roles')
    .upsert(
      { admin_user_id: admin.id, role_id: role.id, granted_by: input.grantedByUserId },
      { onConflict: 'admin_user_id,role_id' },
    );
  if (linkErr) throw new Error(`grant role failed: ${linkErr.message}`);
  invalidateAdminCache(input.targetUserId);
}

export async function setAdminActive(targetUserId: string, isActive: boolean): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('admin_users')
    .update({ is_active: isActive })
    .eq('user_id', targetUserId);
  if (error) throw new Error(`setAdminActive failed: ${error.message}`);
  invalidateAdminCache(targetUserId);
}
