from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "components/alerts/AlertBuilderActionPanel.tsx"

OUT.write_text(
    r"""'use client';

import type { ReactNode } from 'react';
import { Bell, Bot, Hand, Rocket, Sparkles, Zap } from 'lucide-react';
import { AUTO_BUY_DEMO_MINT, dispatchAutoBuyEvent } from '@/lib/alerts/autoBuyDispatch';
import { cn } from '@/lib/utils/cn';
import { useAutoBuyStore } from '@/store/autoBuy';
import { useAutoLaunchStore } from '@/store/autoLaunch';

const UI = {
  border: 'rgba(255, 255, 255, 0.1)',
  elevated: 'rgba(255, 255, 255, 0.07)',
  muted: '#9ba3b0',
  text: '#f0f4fc',
} as const;

export type TwitterRuleExecution = 'notify' | 'auto_buy' | 'auto_launch';

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <motionlessFieldLabel>
      <span className="text-[10px] font-medium" style={{ color: UI.muted }}>
        {children}
      </span>
      {hint ? (
        <span className="max-w-[52%] truncate text-right text-[9px]" style={{ color: UI.muted }}>
          {hint}
        </span>
      ) : null}
    </motionlessFieldLabel>
  );
}
""",
    encoding="utf-8",
)
print("stub only - use full file below")
