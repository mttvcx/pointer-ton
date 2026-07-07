/**
 * Multi-card store — Pointer lets you spin up a card per purpose (Travel,
 * Groceries, Subscriptions…), each with its own nickname, spend + monthly limit,
 * freeze and favourite. Mirrors the "a card for everything" neobank UX but in our
 * world: every card is the same non-custodial account underneath (one balance,
 * one credit line), so a new "card" is really a labelled spend bucket + its own
 * PAN — no new account, no new KYC.
 *
 * DEMO: seeded locally so the experience is full immediately. REAL build: hydrate
 * from `/api/financial/cards` and route mutations through the issuer (Rain/Bridge).
 */
import { useSyncExternalStore } from 'react';

export type CardCategory =
  | 'general'
  | 'travel'
  | 'groceries'
  | 'subscriptions'
  | 'shopping'
  | 'utilities'
  | 'health'
  | 'entertainment';

export type SpendTxn = { id: string; merchant: string; icon: string; amount: number; when: string };

export type PointerCard = {
  id: string;
  last4: string;
  nickname: string;
  category: CardCategory;
  frozen: boolean;
  favourite: boolean;
  monthlyLimit: number; // 0 = no cap
  spentThisMonth: number;
  spends: SpendTxn[];
};

export const CATEGORY_META: Record<
  CardCategory,
  { label: string; icon: string; defaultName: string; hint: string }
> = {
  general: { label: 'General', icon: 'card', defaultName: 'Everyday', hint: 'Day-to-day spending' },
  travel: { label: 'Travel', icon: 'airplane', defaultName: 'For Travel', hint: 'Flights, hotels, transit' },
  groceries: { label: 'Groceries', icon: 'cart', defaultName: 'For Groceries', hint: 'Food & essentials' },
  subscriptions: { label: 'Subscriptions', icon: 'repeat', defaultName: 'Subscriptions', hint: 'Recurring bills' },
  shopping: { label: 'Online shopping', icon: 'bag-handle', defaultName: 'For Shopping', hint: 'E-commerce' },
  utilities: { label: 'Utilities', icon: 'flash', defaultName: 'For Utilities', hint: 'Bills & services' },
  health: { label: 'Health', icon: 'medkit', defaultName: 'For Health', hint: 'Pharmacy & care' },
  entertainment: { label: 'Entertainment', icon: 'game-controller', defaultName: 'Entertainment', hint: 'Fun & media' },
};

export const CARD_CATEGORIES: CardCategory[] = [
  'general', 'travel', 'groceries', 'subscriptions', 'shopping', 'utilities', 'health', 'entertainment',
];

let seq = 100;
const nextLast4 = () => String(1000 + ((seq++ * 37) % 9000));

function seedSpends(items: [string, string, number, string][]): SpendTxn[] {
  return items.map(([merchant, icon, amount, when], i) => ({ id: `sp${i}-${merchant}`, merchant, icon, amount, when }));
}

let cards: PointerCard[] = [
  {
    id: 'card-primary',
    last4: '4242',
    nickname: 'Everyday',
    category: 'general',
    frozen: false,
    favourite: true,
    monthlyLimit: 2000,
    spentThisMonth: 788.22,
    spends: seedSpends([
      ['Apple Store', 'logo-apple', 12.99, 'Today'],
      ['Uber', 'car', 18.4, 'Today'],
      ['Blue Bottle', 'cafe', 6.25, 'Yesterday'],
      ['Amazon', 'bag-handle', 42.1, 'Yesterday'],
    ]),
  },
  {
    id: 'card-travel',
    last4: '1987',
    nickname: 'For Travel',
    category: 'travel',
    frozen: false,
    favourite: true,
    monthlyLimit: 5000,
    spentThisMonth: 1240.5,
    spends: seedSpends([
      ['Delta Air Lines', 'airplane', 486.0, 'Mon'],
      ['Airbnb', 'bed', 312.75, 'Sun'],
      ['Shell', 'flash', 61.2, 'Sat'],
    ]),
  },
  {
    id: 'card-groceries',
    last4: '5672',
    nickname: 'For Groceries',
    category: 'groceries',
    frozen: false,
    favourite: false,
    monthlyLimit: 800,
    spentThisMonth: 512.34,
    spends: seedSpends([
      ['Whole Foods', 'cart', 88.12, 'Today'],
      ['Trader Joe’s', 'cart', 43.6, 'Wed'],
    ]),
  },
  {
    id: 'card-subs',
    last4: '3942',
    nickname: 'Subscriptions',
    category: 'subscriptions',
    frozen: true,
    favourite: false,
    monthlyLimit: 150,
    spentThisMonth: 64.96,
    spends: seedSpends([
      ['Netflix', 'play-circle', 15.49, 'Wed'],
      ['Spotify', 'musical-notes', 11.99, 'Tue'],
      ['iCloud', 'cloud', 2.99, 'Mon'],
    ]),
  },
];

const listeners = new Set<() => void>();
const emit = () => {
  cards = [...cards];
  listeners.forEach((l) => l());
};

export function useCards(): PointerCard[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => cards,
    () => cards,
  );
}

export function createCard(category: CardCategory, nickname?: string): PointerCard {
  const card: PointerCard = {
    id: `card-${Date.now()}`,
    last4: nextLast4(),
    nickname: nickname?.trim() || CATEGORY_META[category].defaultName,
    category,
    frozen: false,
    favourite: false,
    monthlyLimit: 0,
    spentThisMonth: 0,
    spends: [],
  };
  cards.push(card);
  emit();
  return card;
}

function patch(id: string, fn: (c: PointerCard) => PointerCard) {
  cards = cards.map((c) => (c.id === id ? fn(c) : c));
  listeners.forEach((l) => l());
}

export const renameCard = (id: string, nickname: string) => patch(id, (c) => ({ ...c, nickname: nickname.trim() || c.nickname }));
export const setCardFrozen = (id: string, frozen: boolean) => patch(id, (c) => ({ ...c, frozen }));
export const toggleFavourite = (id: string) => patch(id, (c) => ({ ...c, favourite: !c.favourite }));
export const setCardLimit = (id: string, monthlyLimit: number) => patch(id, (c) => ({ ...c, monthlyLimit: Math.max(0, monthlyLimit) }));
export function removeCard(id: string) {
  cards = cards.filter((c) => c.id !== id);
  listeners.forEach((l) => l());
}
