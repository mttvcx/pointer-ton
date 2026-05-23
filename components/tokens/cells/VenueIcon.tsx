'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export const KNOWN_CEX_VENUES = [
  'Binance',
  'Coinbase',
  'MEXC',
  'Kraken',
  'OKX',
  'Bybit',
  'Bitkub',
  'Bridge',
  'Debridge',
  'Changenow',
  'Changelly',
  'OTC Desk',
  'Frontrun',
] as const;

export function venueToSlug(venue: string): string {
  return venue.toLowerCase().replace(/\s+/g, '-');
}

export function isKnownCexVenue(venue: string | null | undefined): boolean {
  if (!venue) return false;
  const norm = venue.trim().toLowerCase();
  return KNOWN_CEX_VENUES.some((v) => v.toLowerCase() === norm);
}

export function isSolanaWalletAddress(value: string): boolean {
  return /^[A-Za-z0-9]{32,44}$/.test(value);
}

export function truncateFundingWallet(wallet: string): string {
  if (wallet.length <= 13) return wallet;
  return `${wallet.slice(0, 5)}...${wallet.slice(-4)}`;
}

type VenueIconProps = {
  venue: string | null | undefined;
  className?: string;
};

/**
 * CEX venues render a 14×14 brand logo from /public/venue-logos/{slug}.svg|.png.
 * Sources: Simple Icons, Iconify, CoinMarketCap exchange icons, and official brand assets.
 * Wallet / unknown funding sources render a muted up-arrow (Axiom parity).
 */
export function VenueIcon({ venue, className }: VenueIconProps) {
  const slug = venue ? venueToSlug(venue) : '';
  const [ext, setExt] = useState<'svg' | 'png'>('svg');
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setExt('svg');
    setLogoError(false);
  }, [slug]);

  const showLogo =
    venue &&
    isKnownCexVenue(venue) &&
    !isSolanaWalletAddress(venue) &&
    !logoError;

  if (showLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/venue-logos/${slug}.${ext}`}
        alt=""
        width={14}
        height={14}
        className={className ?? 'h-3.5 w-3.5 shrink-0 rounded-[2px] object-contain'}
        onError={() => {
          if (ext === 'svg') {
            setExt('png');
            return;
          }
          setLogoError(true);
        }}
      />
    );
  }

  return (
    <ArrowUp
      className={className ?? 'h-3 w-3 shrink-0 text-fg-muted'}
      strokeWidth={2}
      aria-hidden
    />
  );
}
