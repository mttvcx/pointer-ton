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
