'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { GlassModal } from '@/components/ui/GlassModal';
import { ProtocolBrandIcon } from '@/components/tokens/ProtocolBrandIcon';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { applyPulseRecommendedSettings } from '@/lib/pulse/applyPulseRecommendedSettings';
import {
  PULSE_RECOMMENDED_CHECKLIST,
  RECOMMENDED_PROTOCOL_IDS,
} from '@/lib/pulse/pulseRecommendedSettings';
import { pulseProtocolAccentColor } from '@/lib/tokens/pulseProtocolRegistry';
import { protocolBrand } from '@/lib/tokens/protocolBrand';
import type { AppChainId } from '@/lib/chains/appChain';
import {
  modalBtnPrimaryClass,
  modalBtnSecondaryClass,
  modalPreviewPanelClass,
  modalScopeTabClass,
  modalSectionLabelClass,
} from '@/lib/ui/modalChrome';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';

const SCOPE_TABS = [
  { id: 'new', label: 'New Pairs' },
  { id: 'stretch', label: 'Final Stretch' },
  { id: 'migrated', label: 'Migrated' },
] as const;

type PulseRecommendedSettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

function FiltersPreviewMock({ chain }: { chain: AppChainId }) {
  const protocolIds = useMemo(() => RECOMMENDED_PROTOCOL_IDS[chain].slice(0, 8), [chain]);

  return (
    <div className={modalPreviewPanelClass}>
      <div className="flex gap-3 border-b border-border-subtle pb-2">
        {SCOPE_TABS.map((tab, i) => (
          <span key={tab.id} className={modalScopeTabClass(i === 0)}>
            {tab.label}
          </span>
        ))}
      </div>
      <p className={cn('mt-2', modalSectionLabelClass)}>Protocols</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {protocolIds.map((id) => {
          const label = protocolBrand(id)?.label ?? id;
          const color = pulseProtocolAccentColor(id);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold text-fg-primary"
              style={{ borderColor: `${color}55`, backgroundColor: `${color}18` }}
            >
              <ProtocolBrandIcon protocolId={id} dotClassName="h-3 w-3" />
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function PulseRecommendedSettingsModal({ open, onClose }: PulseRecommendedSettingsModalProps) {
  const [pending, setPending] = useState(false);
  const activeChain = useUIStore((s) => s.activeChain);
  const { authenticated, getAccessToken } = usePointerAuth();
  const queryClient = useQueryClient();

  async function handleApply() {
    setPending(true);
    try {
      const { savedRemote } = await applyPulseRecommendedSettings({
        chain: activeChain,
        authenticated,
        getAccessToken,
        queryClient,
      });
      toast.success(
        savedRemote
          ? 'Recommended settings applied to all columns'
          : 'Recommended settings applied locally — sign in to sync presets',
      );
      onClose();
    } catch {
      toast.error('Could not apply settings. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="Recommended settings"
      description="Apply Pulse filters and display defaults in one click."
      maxWidthClass="max-w-[420px]"
      zClass="z-[650]"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className={modalBtnSecondaryClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={pending}
            className={modalBtnPrimaryClass}
          >
            {pending ? 'Applying…' : 'Apply settings'}
          </button>
        </>
      }
    >
      <FiltersPreviewMock chain={activeChain} />

      <p className="mt-4 text-[13px] leading-relaxed text-fg-secondary">
        Hides risky tokens and trims the board to what you need. You can tweak filters anytime from
        each column&apos;s gear icon.
      </p>

      <p className="mt-4 text-[12px] font-semibold text-fg-primary">Includes</p>
      <ul className="mt-2 space-y-2">
        {PULSE_RECOMMENDED_CHECKLIST.map((line) => (
          <li key={line} className="flex items-start gap-2 text-[12px] leading-snug text-fg-secondary">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 text-emerald-400">
              <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
            </span>
            {line}
          </li>
        ))}
      </ul>
    </GlassModal>
  );
}
