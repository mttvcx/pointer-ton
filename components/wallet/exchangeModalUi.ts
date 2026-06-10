import { cn } from '@/lib/utils/cn';

/** Shared Pointer wallet / exchange modal surfaces (not Axiom grey pills). */
export const EX = {
  shell: cn(
    'relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-md flex-col overflow-hidden',
    'rounded-t-xl rounded-b-none border border-border-subtle bg-bg-base',
    'font-sans text-[13px] text-fg-primary shadow-[0_32px_80px_-24px_rgba(0,0,0,0.88)]',
  ),
  header: 'flex shrink-0 items-center justify-between border-b border-border-subtle/50 px-4 py-3',
  title: 'text-base font-semibold tracking-tight text-fg-primary',
  tabBar: 'flex shrink-0 gap-1 border-b border-border-subtle/50 px-3',
  tab: (active: boolean) =>
    cn(
      'relative flex-1 px-2 pb-2.5 pt-2 text-center text-[11px] font-medium capitalize transition',
      active ? 'font-semibold text-fg-primary' : 'text-fg-muted hover:text-fg-secondary',
    ),
  tabIndicator: 'absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent-primary',
  inset: 'rounded-md border border-border-subtle/50 bg-bg-sunken/40',
  control:
    'flex h-9 items-center gap-2 rounded-md border border-border-subtle/50 bg-bg-sunken/40 px-2.5 text-[12px] transition hover:bg-bg-hover/60',
  body: 'min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3',
  footer: 'shrink-0 border-t border-border-subtle/50 bg-bg-raised px-4 py-3',
  cta: cn(
    'btn-press focus-ring w-full rounded-md py-2.5 text-[13px] font-semibold text-white',
    'bg-gradient-to-b from-[#6b77f7] to-[#5865F2]',
    'shadow-[0_4px_14px_-4px_rgba(88,101,242,0.55),inset_0_1px_0_rgb(255_255_255/0.14)]',
    'transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50',
  ),
  link: 'font-semibold text-accent-glow hover:underline',
  muted: 'text-[11px] leading-snug text-fg-muted',
  label: 'text-[10px] font-semibold uppercase tracking-wide text-fg-muted',
} as const;
