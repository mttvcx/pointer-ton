# Generates AlertBuilderActionPanel.tsx without JSX typos.
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "components/alerts/AlertBuilderActionPanel.tsx"

OUT.write_text(
    """'use client';

import type { ReactNode, CSSProperties } from 'react';
import { Bot, Hand, Rocket, Sparkles, Zap } from 'lucide-react';
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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: UI.muted }}>
      {children}
    </p>
  );
}

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-0.5 flex items-baseline justify-between gap-2">
      <span className="text-[10px] font-medium" style={{ color: UI.muted }}>
        {children}
      </span>
      {hint ? (
        <span className="max-w-[52%] truncate text-right text-[9px]" style={{ color: UI.muted }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function GlassCard({
  children,
  className,
  accent,
}: {
  children: ReactNode;
  className?: string;
  accent?: 'emerald' | 'violet';
}) {
  const ring =
    accent === 'emerald'
      ? 'border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.08] to-transparent'
      : accent === 'violet'
        ? 'border-violet-400/25 bg-gradient-to-br from-violet-500/[0.1] to-transparent'
        : 'border-white/[0.08] bg-white/[0.02]';
  return <motionlessGlass>{children}</motionlessGlass>;
}

""".replace("<motionlessGlass>", '<motionlessGlass>').replace("</motionlessGlass>", "</motionlessGlass>"),
    encoding="utf-8",
)
