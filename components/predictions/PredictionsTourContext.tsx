'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import {
  readPredictionsTourPrefs,
  writePredictionsTourPrefs,
  type PredictionsTourPrefs,
} from '@/lib/predictions/tourPrefs';
import type { PredictionDeskCategory, PredictionView } from '@/lib/predictions/marketsDemo';

export type PredictionsDeskTourApi = {
  setDeskCategory: (cat: PredictionDeskCategory) => void;
  setView: (view: PredictionView) => void;
};

type PredictionsTourContextValue = {
  prefs: PredictionsTourPrefs;
  tourActive: boolean;
  stepIndex: number;
  setStepIndex: (index: number | ((prev: number) => number)) => void;
  hintVisible: boolean;
  dismissHint: () => void;
  startTour: () => void;
  stopTour: (opts?: { neverAgain?: boolean }) => void;
  finishTour: () => void;
  registerDeskApi: (api: PredictionsDeskTourApi | null) => void;
  deskApiRef: MutableRefObject<PredictionsDeskTourApi | null>;
};

const PredictionsTourContext = createContext<PredictionsTourContextValue | null>(null);

export function usePredictionsTour() {
  const ctx = useContext(PredictionsTourContext);
  if (!ctx) {
    throw new Error('usePredictionsTour must be used within PredictionsTourProvider');
  }
  return ctx;
}

export function usePredictionsTourOptional() {
  return useContext(PredictionsTourContext);
}

export function PredictionsTourProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<PredictionsTourPrefs>(() => readPredictionsTourPrefs());
  const [tourActive, setTourActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const deskApiRef = useRef<PredictionsDeskTourApi | null>(null);

  const registerDeskApi = useCallback((api: PredictionsDeskTourApi | null) => {
    deskApiRef.current = api;
  }, []);

  const dismissHint = useCallback(() => {
    const next = writePredictionsTourPrefs({ hintDismissed: true });
    setPrefs(next);
  }, []);

  const startTour = useCallback(() => {
    if (prefs.dismissedForever) return;
    const next = writePredictionsTourPrefs({ hintDismissed: true });
    setPrefs(next);
    setStepIndex(0);
    setTourActive(true);
  }, [prefs.dismissedForever]);

  const stopTour = useCallback((opts?: { neverAgain?: boolean }) => {
    setTourActive(false);
    setStepIndex(0);
    if (opts?.neverAgain) {
      const next = writePredictionsTourPrefs({ dismissedForever: true, hintDismissed: true });
      setPrefs(next);
    }
  }, []);

  const finishTour = useCallback(() => {
    setTourActive(false);
    setStepIndex(0);
    const next = writePredictionsTourPrefs({ hintDismissed: true });
    setPrefs(next);
  }, []);

  const hintVisible =
    !prefs.dismissedForever && !prefs.hintDismissed && !tourActive;

  const value = useMemo(
    (): PredictionsTourContextValue => ({
      prefs,
      tourActive,
      stepIndex,
      setStepIndex,
      hintVisible,
      dismissHint,
      startTour,
      stopTour,
      finishTour,
      registerDeskApi,
      deskApiRef,
    }),
    [
      prefs,
      tourActive,
      stepIndex,
      hintVisible,
      dismissHint,
      startTour,
      stopTour,
      finishTour,
      registerDeskApi,
    ],
  );

  return (
    <PredictionsTourContext.Provider value={value}>{children}</PredictionsTourContext.Provider>
  );
}
