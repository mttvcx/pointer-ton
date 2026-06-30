/**
 * Local-first label store (Profiles / Wallets / Groups). Everything lives in
 * chrome.storage.local so the popup is fully functional offline and never
 * redirects to the web app. Pointer-account sync layers on top later (push the
 * same shapes to /api/ext/labels) — the UI reads/writes here regardless.
 */

export type Chain = 'sol' | 'bnb';

export interface WalletLabel {
  id: string;
  address: string;
  chain: Chain;
  label: string;
  group?: string; // LabelGroup.id
  createdAt: number;
}

export interface ProfileLabel {
  id: string;
  handle: string; // X/Twitter handle, no @
  note: string;
  createdAt: number;
}

export interface LabelGroup {
  id: string;
  name: string;
  createdAt: number;
}

const K_WALLETS = 'pointer.labels.wallets';
const K_PROFILES = 'pointer.labels.profiles';
const K_GROUPS = 'pointer.labels.groups';

/** Stable-ish id without Math.random dependence on a single source. */
function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

async function read<T>(key: string): Promise<T[]> {
  const raw = await chrome.storage.local.get(key);
  return (raw[key] as T[] | undefined) ?? [];
}
async function write<T>(key: string, rows: T[]): Promise<void> {
  await chrome.storage.local.set({ [key]: rows });
}

/* ───────────────────────── wallets ───────────────────────── */
export async function getWallets(): Promise<WalletLabel[]> {
  return (await read<WalletLabel>(K_WALLETS)).sort((a, b) => b.createdAt - a.createdAt);
}
export async function addWallet(input: Omit<WalletLabel, 'id' | 'createdAt'>): Promise<WalletLabel> {
  const rows = await read<WalletLabel>(K_WALLETS);
  const row: WalletLabel = { ...input, id: id('w'), createdAt: Date.now() };
  // De-dupe on address+chain: overwrite label/group if it already exists.
  const existing = rows.findIndex(
    (r) => r.address.toLowerCase() === row.address.toLowerCase() && r.chain === row.chain,
  );
  if (existing >= 0) rows[existing] = { ...rows[existing], ...row, id: rows[existing]!.id, createdAt: rows[existing]!.createdAt };
  else rows.push(row);
  await write(K_WALLETS, rows);
  return row;
}
export async function removeWallet(rowId: string): Promise<void> {
  await write(K_WALLETS, (await read<WalletLabel>(K_WALLETS)).filter((r) => r.id !== rowId));
}

/* ───────────────────────── profiles ───────────────────────── */
export async function getProfiles(): Promise<ProfileLabel[]> {
  return (await read<ProfileLabel>(K_PROFILES)).sort((a, b) => b.createdAt - a.createdAt);
}
export async function addProfile(input: Omit<ProfileLabel, 'id' | 'createdAt'>): Promise<ProfileLabel> {
  const rows = await read<ProfileLabel>(K_PROFILES);
  const handle = input.handle.replace(/^@/, '').trim();
  const row: ProfileLabel = { ...input, handle, id: id('p'), createdAt: Date.now() };
  const existing = rows.findIndex((r) => r.handle.toLowerCase() === handle.toLowerCase());
  if (existing >= 0) rows[existing] = { ...rows[existing]!, ...row, id: rows[existing]!.id };
  else rows.push(row);
  await write(K_PROFILES, rows);
  return row;
}
export async function removeProfile(rowId: string): Promise<void> {
  await write(K_PROFILES, (await read<ProfileLabel>(K_PROFILES)).filter((r) => r.id !== rowId));
}

/* ───────────────────────── groups ───────────────────────── */
export async function getGroups(): Promise<LabelGroup[]> {
  return (await read<LabelGroup>(K_GROUPS)).sort((a, b) => a.createdAt - b.createdAt);
}
export async function addGroup(name: string): Promise<LabelGroup> {
  const rows = await read<LabelGroup>(K_GROUPS);
  const trimmed = name.trim();
  const existing = rows.find((g) => g.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  const row: LabelGroup = { id: id('g'), name: trimmed, createdAt: Date.now() };
  rows.push(row);
  await write(K_GROUPS, rows);
  return row;
}
export async function removeGroup(rowId: string): Promise<void> {
  await write(K_GROUPS, (await read<LabelGroup>(K_GROUPS)).filter((r) => r.id !== rowId));
  // Orphan the wallets that pointed at it (keep the labels, drop the group ref).
  const wallets = await read<WalletLabel>(K_WALLETS);
  await write(K_WALLETS, wallets.map((w) => (w.group === rowId ? { ...w, group: undefined } : w)));
}

/* ───────────────────────── import / export ───────────────────────── */
export interface LabelBundle {
  version: 1;
  wallets: WalletLabel[];
  profiles: ProfileLabel[];
  groups: LabelGroup[];
  exportedAt: number;
}

export async function exportAll(): Promise<LabelBundle> {
  return {
    version: 1,
    wallets: await getWallets(),
    profiles: await getProfiles(),
    groups: await getGroups(),
    exportedAt: Date.now(),
  };
}

/** Parse a variety of paste formats. Accepts our LabelBundle JSON, a raw array
 *  of {address,label}, or newline `address,label` / `address<tab>label` text. */
export function parseImport(text: string): { wallets: Array<{ address: string; label: string; chain: Chain }> } {
  const out: Array<{ address: string; label: string; chain: Chain }> = [];
  const t = text.trim();
  if (!t) return { wallets: out };
  // Try JSON first.
  try {
    const j = JSON.parse(t) as unknown;
    const arr = Array.isArray(j)
      ? j
      : (j as LabelBundle)?.wallets ?? [];
    for (const r of arr as Array<Record<string, unknown>>) {
      const address = String(r.address ?? r.wallet ?? '').trim();
      const label = String(r.label ?? r.name ?? r.note ?? '').trim();
      if (address) out.push({ address, label, chain: (r.chain === 'bnb' ? 'bnb' : 'sol') });
    }
    if (out.length) return { wallets: out };
  } catch {
    /* fall through to line parsing */
  }
  // Line format: address[,\t ]label
  for (const line of t.split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Za-z0-9]{20,})[\s,;]+(.*)$/);
    if (m) out.push({ address: m[1]!, label: (m[2] ?? '').trim(), chain: 'sol' });
    else if (/^[A-Za-z0-9]{20,}$/.test(line.trim())) out.push({ address: line.trim(), label: '', chain: 'sol' });
  }
  return { wallets: out };
}

export async function importWallets(rows: Array<{ address: string; label: string; chain: Chain; group?: string }>): Promise<number> {
  let n = 0;
  for (const r of rows) {
    if (!r.address) continue;
    await addWallet({ address: r.address, label: r.label || short(r.address), chain: r.chain, group: r.group });
    n++;
  }
  return n;
}

export function short(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

export async function totalCount(): Promise<number> {
  const [w, p] = await Promise.all([read<WalletLabel>(K_WALLETS), read<ProfileLabel>(K_PROFILES)]);
  return w.length + p.length;
}
