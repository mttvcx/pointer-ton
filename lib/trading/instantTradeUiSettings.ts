export type InstantTradeUiSettings = {
  showPnlRow: boolean;
  changeOnHover: boolean;
  resetPnlOnClose: boolean;
  walletOpensSidebar: boolean;
  walletGroupGrid: boolean;
  hotkeysEnabled: boolean;
};

const KEY = 'pointer-instant-trade-ui-v1';

const defaults: InstantTradeUiSettings = {
  showPnlRow: true,
  changeOnHover: false,
  resetPnlOnClose: false,
  walletOpensSidebar: false,
  walletGroupGrid: false,
  hotkeysEnabled: false,
};

export function readInstantTradeUiSettings(): InstantTradeUiSettings {
  if (typeof window === 'undefined') return { ...defaults };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const j = JSON.parse(raw) as Partial<InstantTradeUiSettings>;
    return { ...defaults, ...j };
  } catch {
    return { ...defaults };
  }
}

export function persistInstantTradeUiSettings(p: InstantTradeUiSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export { defaults as defaultInstantTradeUiSettings };
