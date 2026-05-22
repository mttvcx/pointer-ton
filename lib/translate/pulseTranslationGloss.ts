import { getPulseGoldSubtitle } from '@/lib/tokens/pulseBnbGoldSubtitle';
import {
  tokenMatchesAutoTranslateLanguages,
  type AutoTranslateLanguageId,
} from '@/lib/translate/autoTranslateLanguages';
import type { TokenRow } from '@/types/tokens';
import type { AutoTranslateSettings } from '@/store/autoTranslate';
import { selectAutoTranslateLanguageSet } from '@/store/autoTranslate';

/**
 * Resolves the English / Latin gloss for a Pulse or token header row, honoring
 * Auto Translate user settings.
 */
export function resolvePulseTranslationGloss(
  token: TokenRow,
  settings: Pick<
    AutoTranslateSettings,
    'enabled' | 'translateAllLanguages' | 'selectedLanguageIds'
  >,
): string | null {
  if (!settings.enabled) return null;

  const name = token.name?.trim() ?? '';
  const symbol = token.symbol?.trim() ?? '';

  if (!settings.translateAllLanguages) {
    const selected = selectAutoTranslateLanguageSet(settings);
    if (!tokenMatchesAutoTranslateLanguages(name, symbol, selected)) return null;
  }

  return getPulseGoldSubtitle(token);
}

export type { AutoTranslateLanguageId };
