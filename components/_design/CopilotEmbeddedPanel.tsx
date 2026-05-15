'use client';

import { useState } from 'react';
import {
  ChevronDown,
  PanelRightOpen,
  RotateCcw,
  Send,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * DESIGN SKETCH ONLY. Visual prototype of an always-expanded, hard-embedded
 * Cluely-style co-pilot panel that would replace the small top-bar pill.
 * No real API calls, no real state — values are hardcoded so the user can
 * review the look across themes (Pointer / Axiom / Terminal) before we wire
 * it in for real. Lives under `/design/copilot-sketch`.
 */
export function CopilotEmbeddedPanel() {
  const [input, setInput] = useState('');

  return (
    <div className="border-b border-border-subtle bg-bg-base">
      <div className="mx-auto max-w-4xl px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 items-center gap-2 rounded-md border border-border-subtle bg-bg-raised px-3">
            <Sparkles className="h-3.5 w-3.5 text-accent-primary" />
            <span className="text-xs font-semibold text-fg-primary">Co-pilot</span>
            <span className="ml-1 text-[10px] uppercase tracking-wider text-fg-muted">
              idle
            </span>
          </div>

          <div className="hidden items-center gap-1 md:flex">
            <QuickActionButton icon={<Zap className="h-3 w-3" />} label="Explain token" />
            <QuickActionButton icon={<Zap className="h-3 w-3" />} label="Find risks" />
            <QuickActionButton icon={<Zap className="h-3 w-3" />} label="Build alert" />
            <QuickActionButton icon={<RotateCcw className="h-3 w-3" />} label="Recap" />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              title="Move to side panel"
              className="flex h-7 items-center gap-1 rounded px-2 text-[11px] text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
            >
              <PanelRightOpen className="h-3 w-3" />
              <span className="hidden lg:inline">Tab to side</span>
            </button>
            <button
              type="button"
              title="Collapse"
              className="flex h-7 w-7 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mb-2 rounded-md border border-border-subtle bg-bg-raised p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-primary">
              Latest context
            </span>
            <span className="text-[10px] text-fg-muted">·</span>
            <span className="text-[10px] text-fg-muted">2 min ago</span>
          </div>
          <p className="text-xs leading-relaxed text-fg-secondary">
            <span className="font-semibold text-fg-primary">PRIVET</span> is a fresh
            launch on pump.fun with a $42K market cap. Top 10 holders own{' '}
            <span className="text-signal-warn">42%</span> of supply. Liquidity is
            locked. Dev wallet holds{' '}
            <span className="text-signal-bear">8.2%</span> — slightly above average
            for the safety threshold.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-sunken transition-colors focus-within:border-accent-primary/50">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about bonding curve, holders, risk, or entry..."
            className="h-9 flex-1 bg-transparent px-3 text-xs text-fg-primary placeholder:text-fg-muted focus:outline-none"
          />
          <button
            type="button"
            disabled={!input.trim()}
            className="mr-1 flex h-7 w-7 items-center justify-center rounded bg-accent-primary text-fg-inverse transition-colors hover:bg-accent-glow disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-3 w-3" />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <SuggestionChip>rug pull risk</SuggestionChip>
          <SuggestionChip>bonding curve</SuggestionChip>
          <SuggestionChip>LP locked</SuggestionChip>
          <SuggestionChip>top holders</SuggestionChip>
          <SuggestionChip>bundle risk</SuggestionChip>
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium',
        'text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SuggestionChip({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'h-6 rounded-full bg-bg-sunken px-2 text-[10px] font-medium',
        'text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary',
      )}
    >
      {children}
    </button>
  );
}
