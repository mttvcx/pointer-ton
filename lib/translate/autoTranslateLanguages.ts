/**
 * Auto-translate language registry (Axiom-style). Each entry maps UI metadata to a
 * script detector used when "Translate all languages" is off.
 */

export type AutoTranslateLanguageId =
  | 'ar'
  | 'bn'
  | 'zh-Hans'
  | 'zh-Hant'
  | 'cs'
  | 'nl'
  | 'fil'
  | 'fr'
  | 'de'
  | 'el'
  | 'he'
  | 'hi'
  | 'id'
  | 'it'
  | 'ja'
  | 'ko'
  | 'no'
  | 'fa'
  | 'pl'
  | 'pt'
  | 'ro'
  | 'ru'
  | 'es'
  | 'sw'
  | 'ta'
  | 'te'
  | 'th'
  | 'tr'
  | 'uk'
  | 'ur'
  | 'vi';

export type AutoTranslateLanguage = {
  id: AutoTranslateLanguageId;
  region: string;
  native: string;
  english: string;
  test: RegExp;
};

export const AUTO_TRANSLATE_LANGUAGES: readonly AutoTranslateLanguage[] = [
  { id: 'ar', region: 'SA', native: 'العربية', english: 'Arabic', test: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/ },
  { id: 'bn', region: 'BD', native: 'বাংলা', english: 'Bengali', test: /[\u0980-\u09ff]/ },
  { id: 'zh-Hans', region: 'CN', native: '简体中文', english: 'Chinese Simplified', test: /[\u4e00-\u9fff]/ },
  {
    id: 'zh-Hant',
    region: 'TW',
    native: '繁體中文',
    english: 'Chinese Traditional',
    test: /[\u3400-\u4dbf\u4e00-\u9fff]/,
  },
  { id: 'cs', region: 'CZ', native: 'Čeština', english: 'Czech', test: /[\u0100-\u017f\u0180-\u024f]/ },
  { id: 'nl', region: 'NL', native: 'Nederlands', english: 'Dutch', test: /[\u0100-\u017f]/ },
  { id: 'fil', region: 'PH', native: 'Filipino', english: 'Filipino', test: /[\u1700-\u171f]/ },
  { id: 'fr', region: 'FR', native: 'Français', english: 'French', test: /[\u00c0-\u00ff]/ },
  { id: 'de', region: 'DE', native: 'Deutsch', english: 'German', test: /[\u00c0-\u00ff]/ },
  { id: 'el', region: 'GR', native: 'Ελληνικά', english: 'Greek', test: /[\u0370-\u03ff]/ },
  { id: 'he', region: 'IL', native: 'עברית', english: 'Hebrew', test: /[\u0590-\u05ff\ufb1d-\ufdff]/ },
  { id: 'hi', region: 'IN', native: 'हिन्दी', english: 'Hindi', test: /[\u0900-\u097f]/ },
  { id: 'id', region: 'ID', native: 'Indonesia', english: 'Indonesian', test: /[\u1780-\u17ff]/ },
  { id: 'it', region: 'IT', native: 'Italiano', english: 'Italian', test: /[\u00c0-\u00ff]/ },
  { id: 'ja', region: 'JP', native: '日本語', english: 'Japanese', test: /[\u3040-\u30ff\u31a0-\u31bf\u4e00-\u9fff]/ },
  { id: 'ko', region: 'KR', native: '한국어', english: 'Korean', test: /[\uac00-\ud7af\u1100-\u11ff]/ },
  { id: 'no', region: 'NO', native: 'Norsk', english: 'Norwegian', test: /[\u00c0-\u00ff]/ },
  { id: 'fa', region: 'IR', native: 'فارسی', english: 'Persian', test: /[\u0600-\u06ff\u0750-\u077f]/ },
  { id: 'pl', region: 'PL', native: 'Polski', english: 'Polish', test: /[\u0100-\u024f]/ },
  { id: 'pt', region: 'PT', native: 'Português', english: 'Portuguese', test: /[\u00c0-\u00ff]/ },
  { id: 'ro', region: 'RO', native: 'Română', english: 'Romanian', test: /[\u0100-\u024f]/ },
  { id: 'ru', region: 'RU', native: 'Русский', english: 'Russian', test: /[\u0400-\u04ff]/ },
  { id: 'es', region: 'ES', native: 'Español', english: 'Spanish', test: /[\u00c0-\u00ff]/ },
  { id: 'sw', region: 'KE', native: 'Kiswahili', english: 'Swahili', test: /[\u0100-\u024f]/ },
  { id: 'ta', region: 'IN', native: 'தமிழ்', english: 'Tamil', test: /[\u0b80-\u0bff]/ },
  { id: 'te', region: 'IN', native: 'తెలుగు', english: 'Telugu', test: /[\u0c00-\u0c7f]/ },
  { id: 'th', region: 'TH', native: 'ไทย', english: 'Thai', test: /[\u0e00-\u0e7f]/ },
  { id: 'tr', region: 'TR', native: 'Türkçe', english: 'Turkish', test: /[\u00c0-\u024f\u011e\u011f\u0130\u0131\u015e\u015f]/ },
  { id: 'uk', region: 'UA', native: 'Українська', english: 'Ukrainian', test: /[\u0400-\u04ff]/ },
  { id: 'ur', region: 'PK', native: 'اردو', english: 'Urdu', test: /[\u0600-\u06ff\u0750-\u077f]/ },
  { id: 'vi', region: 'VN', native: 'Tiếng Việt', english: 'Vietnamese', test: /[\u0102\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]/ },
] as const;

export const DEFAULT_AUTO_TRANSLATE_LANGUAGE_IDS: AutoTranslateLanguageId[] = [
  'ar',
  'bn',
  'zh-Hans',
  'zh-Hant',
  'he',
  'hi',
  'id',
  'ja',
  'ko',
  'ta',
  'te',
  'th',
  'ru',
  'uk',
  'vi',
  'fa',
  'ur',
];

/** Languages whose script appears in `text` (name, symbol, etc.). */
export function detectAutoTranslateLanguages(text: string): AutoTranslateLanguageId[] {
  const t = text.trim();
  if (!t) return [];
  const hits: AutoTranslateLanguageId[] = [];
  for (const lang of AUTO_TRANSLATE_LANGUAGES) {
    if (lang.test.test(t)) hits.push(lang.id);
  }
  return hits;
}

export function tokenMatchesAutoTranslateLanguages(
  name: string,
  symbol: string,
  selected: ReadonlySet<AutoTranslateLanguageId>,
): boolean {
  const combined = `${name}\n${symbol}`;
  const detected = detectAutoTranslateLanguages(combined);
  if (detected.length === 0) return false;
  return detected.some((id) => selected.has(id));
}
