import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AUTO_TRANSLATE_LANGUAGES,
  DEFAULT_AUTO_TRANSLATE_LANGUAGE_IDS,
  type AutoTranslateLanguageId,
} from '@/lib/translate/autoTranslateLanguages';

export type AutoTranslateSettings = {
  enabled: boolean;
  showOnHover: boolean;
  showBoth: boolean;
  textColor: string;
  translateAllLanguages: boolean;
  selectedLanguageIds: AutoTranslateLanguageId[];
};

export const DEFAULT_AUTO_TRANSLATE_SETTINGS: AutoTranslateSettings = {
  enabled: true,
  showOnHover: true,
  showBoth: true,
  textColor: '#F2C366',
  translateAllLanguages: false,
  selectedLanguageIds: [...DEFAULT_AUTO_TRANSLATE_LANGUAGE_IDS],
};

type AutoTranslateState = AutoTranslateSettings & {
  setSettings: (patch: Partial<AutoTranslateSettings>) => void;
  toggleLanguage: (id: AutoTranslateLanguageId) => void;
  setAllLanguages: (selected: boolean) => void;
  resetSettings: () => void;
};

export const useAutoTranslateStore = create<AutoTranslateState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_AUTO_TRANSLATE_SETTINGS,
      setSettings: (patch) => set((s) => ({ ...s, ...patch })),
      toggleLanguage: (id) => {
        const cur = new Set(get().selectedLanguageIds);
        if (cur.has(id)) cur.delete(id);
        else cur.add(id);
        set({ selectedLanguageIds: [...cur] });
      },
      setAllLanguages: (selected) => {
        set({
          selectedLanguageIds: selected
            ? AUTO_TRANSLATE_LANGUAGES.map((l) => l.id)
            : [],
        });
      },
      resetSettings: () => set({ ...DEFAULT_AUTO_TRANSLATE_SETTINGS }),
    }),
    { name: 'pointer.auto-translate' },
  ),
);

export function selectAutoTranslateLanguageSet(
  settings: Pick<AutoTranslateSettings, 'translateAllLanguages' | 'selectedLanguageIds'>,
): ReadonlySet<AutoTranslateLanguageId> {
  if (settings.translateAllLanguages) {
    return new Set(AUTO_TRANSLATE_LANGUAGES.map((l) => l.id));
  }
  return new Set(settings.selectedLanguageIds);
}
