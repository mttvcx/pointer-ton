'use client';

import { cn } from '@/lib/utils/cn';

export type GlassVariant = 'default' | 'hero' | 'primary' | 'secondary' | 'quiet';

export function GlassPanel({
  className,
  children,
  glow,
  variant = 'default',
}: {
  className?: string;
  children: React.ReactNode;
  glow?: 'cyan' | 'violet' | 'none';
  variant?: GlassVariant;
}) {
  const glowCls =
    glow === 'cyan'
      ? 'shadow-[0_0_80px_-20px_rgba(0,163,224,0.38)]'
      : glow === 'violet'
        ? 'shadow-[0_0_90px_-28px_rgba(167,139,250,0.35)]'
        : '';
  const variantCls =
    variant === 'hero'
      ? 'points-glass-hero rounded-2xl border'
      : variant === 'primary'
        ? 'points-glass-primary rounded-2xl border'
        : variant === 'secondary'
          ? 'points-glass-secondary rounded-xl border'
          : variant === 'quiet'
            ? 'points-glass-quiet rounded-xl border'
            : 'rounded-xl border border-border-subtle bg-bg-base/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md';
  const sheen =
    variant === 'hero' || variant === 'primary' ? (
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,0.06)_0%,transparent_42%,rgba(167,139,250,0.04)_100%)]" />
    ) : variant === 'default' ? (
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.03)_0%,transparent_45%,transparent_100%)]" />
    ) : (
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_40%)]" />
    );
  return (
    <div className={cn('relative overflow-hidden', variantCls, glowCls, className)}>
      {sheen}
      <div className="relative">{children}</div>
    </div>
  );
}

export function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-[20%] -top-[40%] h-[min(520px,80vw)] w-[min(520px,80vw)] rounded-full bg-[radial-gradient(circle,rgba(0,163,224,0.18)_0%,transparent_68%)] blur-3xl" />
      <div className="absolute -right-[15%] top-[10%] h-[min(440px,70vw)] w-[min(440px,70vw)] rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.15)_0%,transparent_65%)] blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-[min(280px,50vw)] w-[min(280px,50vw)] rounded-full bg-[radial-gradient(circle,rgba(0,119,182,0.08)_0%,transparent_70%)] blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  );
}
