'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Smartphone, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { GlassModal } from '@/components/ui/GlassModal';
import { modalBtnPrimaryClass, modalBtnSecondaryClass } from '@/lib/ui/modalChrome';
import type { CreatorPlatform } from '@/lib/creators/config';
import {
  VERIFICATION_REJECT_RULES,
  verificationGuideFor,
} from '@/lib/creators/verificationGuide';
import { cn } from '@/lib/utils/cn';

export type VerificationAccount = {
  id: string;
  platform: CreatorPlatform;
  handle: string;
  verification_status: string;
};

type AudienceVerificationModalProps = {
  open: boolean;
  onClose: () => void;
  account: VerificationAccount | null;
  onSubmitted?: () => void;
};

function PhoneExampleVideo({ src, platformLabel }: { src: string; platformLabel: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    void el.play().catch(() => undefined);
  }, [src]);

  return (
    <div className="flex flex-col">
      <div className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Example</p>
        <p className="mt-0.5 text-[13px] font-medium text-fg-primary">One continuous clip</p>
        <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
          Second phone filming {platformLabel} analytics — exactly how your submission should look.
        </p>
      </div>

      <div className="relative mx-auto flex w-full max-w-[248px] flex-col">
        <div className="pointer-events-none absolute -inset-2 rounded-[2rem] bg-accent-primary/10 blur-2xl" />
        <div className="relative overflow-hidden rounded-[1.75rem] border-[3px] border-white/10 bg-black shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]">
          <div className="absolute left-1/2 top-2 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/20" />
          <video
            ref={videoRef}
            src={src}
            className="aspect-[9/16] w-full bg-black object-cover"
            controls
            playsInline
            loop
            muted
            preload="metadata"
          />
        </div>
        <p className="mt-3 text-center text-[10px] leading-relaxed text-fg-muted">
          Watch the full example before recording yours.
        </p>
      </div>
    </div>
  );
}

export function AudienceVerificationModal({
  open,
  onClose,
  account,
  onSubmitted,
}: AudienceVerificationModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const guide = account ? verificationGuideFor(account.platform) : null;

  useEffect(() => {
    if (!open) {
      setFile(null);
      setDragOver(false);
      setBusy(false);
    }
  }, [open]);

  const pickFile = useCallback((next: File | null) => {
    if (!next) {
      setFile(null);
      return;
    }
    const okType = next.type === 'video/mp4' || next.type === 'video/quicktime';
    if (!okType) {
      toast.error('Upload MP4 or MOV only');
      return;
    }
    if (next.size > 52_428_800) {
      toast.error('Max file size is 50MB');
      return;
    }
    setFile(next);
  }, []);

  async function submit() {
    if (!account || !file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('accountId', account.id);
      fd.set('file', file);
      const res = await fetch('/api/creators/verification/upload', { method: 'POST', body: fd });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(j.error ?? 'Upload failed');
        return;
      }
      toast.success('Verification submitted — admin review within 48h');
      onSubmitted?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  if (!account || !guide) return null;

  const canUpload =
    account.verification_status === 'needs_verification' ||
    account.verification_status === 'rejected';

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="Verify audience demographics"
      description={
        <>
          <span className="capitalize">{account.platform}</span> · @{account.handle}
        </>
      }
      glass
      maxWidthClass="max-w-5xl"
      className="max-h-[min(92vh,860px)]"
      footer={
        canUpload ? (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className={modalBtnSecondaryClass}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!file || busy}
              onClick={() => void submit()}
              className={modalBtnPrimaryClass}
            >
              {busy ? 'Uploading…' : 'Submit verification'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className={modalBtnSecondaryClass}
          >
            Close
          </button>
        )
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="min-w-0 space-y-3.5">
          <div className="rounded-xl border border-signal-warn/25 bg-signal-warn/[0.08] p-3.5">
            <div className="flex gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal-warn" />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-signal-warn">Physical recording required</p>
                <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-fg-secondary">
                  {VERIFICATION_REJECT_RULES.map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-signal-bear/80" />
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="creator-glass-quiet rounded-xl p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">Where to navigate</p>
            <p className="mt-1 text-[12px] leading-relaxed text-fg-primary">{guide.analyticsPath}</p>
          </div>

          <div className="creator-glass-quiet rounded-xl p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Steps</p>
            <ol className="mt-2.5 space-y-2">
              {guide.steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-[12px] leading-relaxed text-fg-secondary">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-primary/15 text-[10px] font-bold tabular-nums text-accent-glow">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {canUpload ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Your recording</p>
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickFile(e.dataTransfer.files[0] ?? null);
                }}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-7 transition-colors',
                  dragOver
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-white/15 bg-white/[0.02] hover:border-accent-primary/40 hover:bg-white/[0.04]',
                )}
              >
                <Upload className="h-6 w-6 text-fg-muted" />
                <p className="mt-2 max-w-full truncate text-[13px] font-medium text-fg-primary">
                  {file ? file.name : 'Drop MP4/MOV or click to browse'}
                </p>
                <p className="mt-1 text-[11px] text-fg-muted">Max 50MB · one continuous clip</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="video/mp4,video/quicktime"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          ) : (
            <div className="creator-glass-quiet flex items-start gap-2 rounded-xl p-3.5 text-[12px] text-fg-secondary">
              {account.verification_status === 'verified' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-signal-bull" />
              ) : (
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" />
              )}
              {account.verification_status === 'pending'
                ? 'Your verification is under admin review. You will be notified when approved.'
                : account.verification_status === 'verified'
                  ? 'This account is verified — you can submit clips.'
                  : 'Contact support or submit an appeal if you need to re-verify.'}
            </div>
          )}
        </div>

        <div className="min-w-0 lg:border-l lg:border-white/[0.06] lg:pl-5">
          <PhoneExampleVideo src={guide.exampleVideoSrc} platformLabel={guide.platformLabel} />
        </div>
      </div>
    </GlassModal>
  );
}
