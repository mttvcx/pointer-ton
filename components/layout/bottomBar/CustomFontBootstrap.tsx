'use client';

import { useEffect } from 'react';
import { applyCustomFontUrl } from '@/lib/ui/customFont';
import { useShellPrefsStore } from '@/store/shellPrefs';

export function CustomFontBootstrap() {
  const url = useShellPrefsStore((s) => s.customFontUrl);

  useEffect(() => {
    applyCustomFontUrl(url);
  }, [url]);

  return null;
}
