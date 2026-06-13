const STORAGE_KEY = 'pointer-kalshi-tour-v1';

export type PredictionsTourPrefs = {
  /** User checked "Don't ask me again" when exiting — hide tour permanently. */
  dismissedForever: boolean;
  /** Dismissed the first-visit "Take a tour" hint on the help button. */
  hintDismissed: boolean;
};

const DEFAULT_PREFS: PredictionsTourPrefs = {
  dismissedForever: false,
  hintDismissed: false,
};

function readRaw(): PredictionsTourPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<PredictionsTourPrefs>;
    return {
      dismissedForever: parsed.dismissedForever === true,
      hintDismissed: parsed.hintDismissed === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function readPredictionsTourPrefs(): PredictionsTourPrefs {
  return readRaw();
}

export function writePredictionsTourPrefs(partial: Partial<PredictionsTourPrefs>): PredictionsTourPrefs {
  const next = { ...readRaw(), ...partial };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

/** Demo market used when the tour opens the detail trading desk. */
export const PREDICTIONS_TOUR_MARKET_ID = 'btc-120k';
