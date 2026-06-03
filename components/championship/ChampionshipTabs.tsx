'use client';

import type { ChampionshipTab } from '@/lib/championship/types';
import { cn } from '@/lib/utils/cn';

const TABS: { id: ChampionshipTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'solo', label: 'Solo' },
  { id: 'squads', label: 'Squads' },
  { id: 'worldcup', label: 'World Cup' },
  { id: 'rules', label: 'Rules' },
];

interface ChampionshipTabsProps {
  active: ChampionshipTab;
  onChange: (tab: ChampionshipTab) => void;
}

export function ChampionshipTabs({ active, onChange }: ChampionshipTabsProps) {
  return (
    <nav
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-border-subtle bg-bg-base/60 px-3 py-2 sm:px-5"
      aria-label="Championship sections"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'btn-press shrink-0 rounded-sm px-3.5 py-1.5 text-sm font-semibold transition',
            active === tab.id
              ? 'bg-accent-primary text-fg-inverse shadow-[0_0_20px_-4px_rgb(var(--accent-primary-rgb)/0.55)]'
              : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
