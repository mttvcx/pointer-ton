'use client';

import type { SibylAnswer } from '@/sibyl/types';

/** Persisted chat — messages carry the full answer so history reopens intact. */
export type StoredMsg = { id: string; role: 'user' | 'sibyl'; text?: string; answer?: SibylAnswer };
export type StoredChat = { id: string; title: string; messages: StoredMsg[]; ts: number };

const KEY = 'sibyl-chats-v1';
const MAX_CHATS = 50;

function read(): StoredChat[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? (raw as StoredChat[]) : [];
  } catch {
    return [];
  }
}

function write(chats: StoredChat[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(chats.slice(0, MAX_CHATS)));
  } catch {
    /* quota / private mode — ignore */
  }
}

/** All chats, newest first. */
export function listChats(): StoredChat[] {
  return read().sort((a, b) => b.ts - a.ts);
}

export function getChat(id: string): StoredChat | null {
  return read().find((c) => c.id === id) ?? null;
}

/** Upsert a chat (moves it to the top). */
export function saveChat(chat: StoredChat): void {
  const rest = read().filter((c) => c.id !== chat.id);
  rest.unshift(chat);
  write(rest);
}

export function deleteChat(id: string): void {
  write(read().filter((c) => c.id !== id));
}

/** Deterministic-enough client id (client-only, so Date/Math are fine here). */
export function newChatId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Whether the user has ever engaged (drives "no grass entry on subsequent visits"). */
export function hasHistory(): boolean {
  return read().length > 0;
}

export function clearChats(): void {
  write([]);
}

/** Serialize every chat for a manual backup download. */
export function exportChats(): string {
  return JSON.stringify({ v: 1, exportedAt: new Date().toISOString(), chats: read() }, null, 2);
}

/** Merge a backup file back in (upsert by id, newest kept). Returns how many were restored. */
export function importChats(raw: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 0;
  }
  const incoming: StoredChat[] = Array.isArray(parsed)
    ? (parsed as StoredChat[])
    : Array.isArray((parsed as { chats?: unknown })?.chats)
      ? ((parsed as { chats: StoredChat[] }).chats)
      : [];
  const valid = incoming.filter(
    (c) => c && typeof c.id === 'string' && Array.isArray(c.messages),
  );
  if (valid.length === 0) return 0;
  const byId = new Map<string, StoredChat>();
  for (const c of [...read(), ...valid]) byId.set(c.id, c); // incoming wins on collision
  write([...byId.values()].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)));
  return valid.length;
}
