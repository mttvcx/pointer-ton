'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useRef, useState } from 'react';
import { Camera, Pencil } from 'lucide-react';
import { GlassModal } from '@/components/ui/GlassModal';
import { cn } from '@/lib/utils/cn';
import { toast } from 'sonner';

const BANNER_STRIPES =
  'repeating-linear-gradient(-35deg, transparent, transparent 12px, rgb(var(--fg-primary-rgb) / 0.04) 12px, rgb(var(--fg-primary-rgb) / 0.04) 24px)';

export function SquadsLobbyProfileModal({
  open,
  onClose,
  handle = 'pointer_user',
}: {
  open: boolean;
  onClose: () => void;
  handle?: string;
}) {
  const [bio, setBio] = useState('');
  const [editing, setEditing] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const monogram = handle.slice(0, 2).toUpperCase();

  function pickImage(
    file: File | undefined,
    kind: 'banner' | 'avatar',
    setUrl: Dispatch<SetStateAction<string | null>>,
  ) {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Pick an image file');
      return;
    }
    const url = URL.createObjectURL(file);
    setUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return url;
    });
    toast.success(`${kind === 'banner' ? 'Banner' : 'Avatar'} updated`);
  }

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-[400px]"
      zClass="z-[650]"
      className="overflow-visible"
    >
      <div className="-mx-4 -mt-3 overflow-hidden rounded-t-2xl">
        <button
          type="button"
          title="Change banner"
          aria-label="Change banner image"
          onClick={() => bannerInputRef.current?.click()}
          className="group/banner relative block h-24 w-full cursor-pointer border-0 bg-bg-sunken text-left"
        >
          {bannerUrl ? (
            <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div
              className="absolute inset-0 bg-gradient-to-br from-accent-primary/30 via-accent-glow/15 to-bg-sunken"
              style={{ backgroundImage: BANNER_STRIPES }}
            />
          )}
          <span className="absolute inset-0 bg-bg-sunken/0 transition group-hover/banner:bg-bg-sunken/50" />
          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover/banner:opacity-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-base/80 text-fg-primary backdrop-blur-sm ring-1 ring-border-subtle">
              <Camera className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
          </span>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              pickImage(e.target.files?.[0], 'banner', setBannerUrl);
              e.target.value = '';
            }}
          />
        </button>

        <div className="relative px-4 pb-1">
          <div className="flex items-end justify-between gap-3">
            <div className="relative -mt-8">
              <button
                type="button"
                title="Change profile photo"
                aria-label="Change profile photo"
                onClick={() => avatarInputRef.current?.click()}
                className="group/avatar relative block rounded-full border-4 border-bg-base focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-primary/20 text-lg font-bold text-accent-primary">
                    {monogram}
                  </span>
                )}
                <span className="absolute inset-0 rounded-full bg-bg-sunken/0 transition group-hover/avatar:bg-bg-sunken/55" />
                <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover/avatar:opacity-100">
                  <Camera className="h-5 w-5 text-fg-primary drop-shadow-sm" strokeWidth={2} aria-hidden />
                </span>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  pickImage(e.target.files?.[0], 'avatar', setAvatarUrl);
                  e.target.value = '';
                }}
              />
              <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border-subtle bg-bg-raised px-2 py-0.5 text-[10px] font-medium text-fg-secondary shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-bull" aria-hidden />
                Online
              </span>
            </div>

            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className={cn(
                'btn-press mb-1 flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition',
                editing
                  ? 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary'
                  : 'border-border-subtle bg-bg-hover text-fg-secondary hover:border-border-default hover:text-fg-primary',
              )}
            >
              <Pencil className="h-3 w-3" strokeWidth={2} aria-hidden />
              {editing ? 'Done' : 'Edit'}
            </button>
          </div>

          <p className="mt-3 text-[15px] font-semibold text-fg-primary">{handle}</p>
        </div>
      </div>

      <div className="mt-3 space-y-4">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          readOnly={!editing}
          placeholder="Tell us about yourself…"
          rows={3}
          className={cn(
            'w-full resize-none rounded-md border bg-bg-hover px-3 py-2.5 text-[13px] text-fg-primary placeholder:text-fg-muted focus:outline-none',
            editing
              ? 'border-accent-primary/35 ring-1 ring-accent-primary/20'
              : 'border-border-subtle',
          )}
        />

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-fg-muted">
            <span aria-hidden>🔗</span> Link accounts
          </p>
          <div className="space-y-2">
            <VerifyButton
              label="Verify Twitter/X"
              icon={<span className="text-[13px] font-bold text-fg-primary">𝕏</span>}
              onClick={() => toast.message('Twitter verification — demo')}
            />
            <VerifyButton
              label="Verify Twitch"
              icon={<span className="text-[13px] font-bold text-signal-info">⌁</span>}
              onClick={() => toast.message('Twitch verification — demo')}
            />
          </div>
        </div>
      </div>
    </GlassModal>
  );
}

function VerifyButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-press flex w-full items-center gap-3 rounded-md border border-border-subtle bg-bg-base/50 px-3 py-2.5 text-left transition hover:border-border-default hover:bg-bg-hover"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-hover">{icon}</span>
      <span className="text-[13px] font-medium text-fg-primary">{label}</span>
    </button>
  );
}
