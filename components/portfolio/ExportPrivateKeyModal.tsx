'use client';

import { useCallback, useEffect, useState } from 'react';
import { useGetWalletPrivateKey, usePrivy } from '@privy-io/react-auth';
import { Copy, Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react';
import { CloseButton } from '@/components/ui/CloseButton';
import { toast } from 'sonner';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import {
  decryptHpkeWalletExport,
  generateP256ExportKeyPair,
} from '@/lib/privy/hpkeWalletExport';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { loginWithOAuthPopup } from '@/lib/auth/oauthPopup';

type Step = 'private-key' | 'security' | 'revealed';

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

async function fetchServerExportedKey(
  getAccessToken: () => Promise<string | null>,
  walletAddress: string,
): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('no_token');
  const res = await fetch('/api/wallets/export-key', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ wallet_address: walletAddress }),
  });
  const json: unknown = await res.json();
  if (!res.ok) {
    const msg =
      typeof json === 'object' && json && 'message' in json
        ? String((json as { message: unknown }).message)
        : 'export_failed';
    throw new Error(msg);
  }
  if (
    typeof json !== 'object' ||
    !json ||
    !('private_key' in json) ||
    typeof (json as { private_key: unknown }).private_key !== 'string'
  ) {
    throw new Error('invalid_export_response');
  }
  return (json as { private_key: string }).private_key;
}

export function ExportPrivateKeyModal({
  wallet,
  open,
  onClose,
}: {
  wallet: MyWalletRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const { ready: privyReady } = usePrivy();
  const { getAccessToken } = usePointerAuth();
  const { getWalletPrivateKey } = useGetWalletPrivateKey();
  const [step, setStep] = useState<Step>('private-key');
  const [busy, setBusy] = useState(false);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const reset = useCallback(() => {
    setStep('private-key');
    setBusy(false);
    setPrivateKey(null);
    setShowKey(false);
  }, []);

  const runExport = useCallback(async () => {
    if (!wallet) return;
    setBusy(true);
    try {
      let key: string | null = null;

      try {
        const { recipientPublicKey, recipientPrivateKeyPkcs8 } = await generateP256ExportKeyPair();
        const encrypted = await getWalletPrivateKey({
          address: wallet.wallet_address,
          recipientPublicKey,
        });
        key = await decryptHpkeWalletExport(
          recipientPrivateKeyPkcs8,
          encrypted.encapsulatedKey,
          encrypted.ciphertext,
        );
      } catch (clientErr) {
        const msg = clientErr instanceof Error ? clientErr.message : '';
        if (!/unified|on-device|not supported/i.test(msg)) {
          try {
            key = await fetchServerExportedKey(getAccessToken, wallet.wallet_address);
          } catch {
            throw clientErr;
          }
        } else {
          key = await fetchServerExportedKey(getAccessToken, wallet.wallet_address);
        }
      }

      setPrivateKey(key.trim());
      setStep('revealed');
      setShowKey(true);
      toast.success('Verified');
    } catch (e: unknown) {
      console.error('[ExportPrivateKeyModal] export private key failed', e);
      toast.error('Could not export private key', {
        description: 'Try again with the same account you signed in with.',
      });
    } finally {
      setBusy(false);
    }
  }, [wallet, getWalletPrivateKey, getAccessToken]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  async function onContinueWithGoogle() {
    if (!privyReady || !wallet || busy) return;
    setStep('security');
    setBusy(true);
    try {
      await loginWithOAuthPopup('google');
      await runExport();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'popup_blocked') {
        toast.error('Allow popups to verify with Google', {
          description: 'Pointer keeps you on this page — Google opens in a small window.',
        });
      } else {
        toast.error('Google verification failed', {
          description: 'Use the same Google account you signed in with.',
        });
      }
      setStep('private-key');
    } finally {
      setBusy(false);
    }
  }

  if (!open || !wallet) return null;

  const title = step === 'security' ? 'Security Check' : 'Private Key';
  const revealed = step === 'revealed' && privateKey != null;

  return (
    <div className="fixed inset-0 z-[560] flex animate-in fade-in items-center justify-center p-4 duration-200">
      <button
        type="button"
        className="absolute inset-0 bg-black/90 backdrop-blur-[2px]"
        aria-label="Dismiss"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-private-key-title"
        className="relative w-full max-w-[400px] animate-in zoom-in-95 fade-in overflow-hidden rounded-xl border border-border-subtle bg-bg-base shadow-[0_32px_80px_-24px_rgba(0,0,0,0.9)] duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 pb-1 pt-4">
          <h2 id="export-private-key-title" className="text-center text-[17px] font-semibold tracking-tight text-fg-primary">
            {title}
          </h2>
          <CloseButton
            disabled={busy}
            onClick={onClose}
            label="Close"
            size="sm"
            className="absolute right-3 top-3"
          />
        </div>

        <div className="space-y-4 px-5 pb-5 pt-2">
          {step === 'security' ? (
            <>
              <button
                type="button"
                disabled={!privyReady || busy}
                onClick={onContinueWithGoogle}
                className={cn(
                  'btn-press focus-ring flex w-full items-center justify-center gap-2.5 rounded-lg border border-border-subtle/80 bg-bg-sunken/70 px-3 py-3',
                  'text-[13px] font-medium text-fg-primary transition hover:border-border-subtle hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
                Continue with Google
              </button>
              <p className="text-center text-[11px] leading-relaxed text-[#f472b6]">
                Showing your private keys. DO NOT verify if you are not exporting your private keys.
              </p>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <span className="text-[12px] font-medium text-fg-secondary">Wallet address</span>
                <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-sunken/60 px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-primary">
                    {shortenAddress(wallet.wallet_address, 10)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(wallet.wallet_address);
                      toast.success('Address copied');
                    }}
                    className="btn-press focus-ring rounded-md p-1 text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
                    aria-label="Copy address"
                  >
                    <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-fg-secondary">Private Key</span>
                  {revealed ? (
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
                    >
                      {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {showKey ? 'Hide' : 'Show'}
                    </button>
                  ) : null}
                </div>
                <div
                  className={cn(
                    'min-h-[72px] break-all rounded-lg border border-border-subtle bg-bg-sunken/50 px-3 py-3',
                    !revealed || !showKey ? 'select-none blur-md' : '',
                  )}
                >
                  <span className="font-mono text-[11px] leading-relaxed text-fg-primary">
                    {revealed && showKey
                      ? privateKey
                      : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                  </span>
                </div>
              </div>

              {!revealed ? (
                <button
                  type="button"
                  disabled={!privyReady || busy}
                  onClick={() => setStep('security')}
                  className={cn(
                    'btn-press focus-ring flex w-full items-center justify-center rounded-lg py-2.5 text-[13px] font-semibold text-fg-primary',
                    'border border-border-subtle bg-bg-sunken/70 transition hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  Reveal private key
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!privateKey}
                  onClick={() => {
                    if (!privateKey) return;
                    void navigator.clipboard.writeText(privateKey);
                    toast.success('Private key copied');
                  }}
                  className={cn(
                    'btn-press focus-ring flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold text-fg-primary',
                    'border border-border-subtle bg-bg-sunken/70 transition hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <Copy className="h-4 w-4" strokeWidth={2} />
                  Copy private key
                </button>
              )}

              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#f87171]">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span>
                  WARNING: Your private key grants complete control over this wallet. NEVER SHARE IT WITH ANYONE. Store
                  it securely.
                </span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
