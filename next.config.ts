import type { NextConfig } from 'next';
import path from 'node:path';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // Pin workspace root so Turbopack stops climbing into ~/ when it sees the
  // user's stray package-lock.json there.
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Token images come from many CDNs. Restrict to a known-safe set; expand
  // as new launchpads appear.
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 420, 640, 750, 828, 1080, 1200, 1400],
    imageSizes: [16, 24, 32, 48, 64, 96, 128, 192],
    minimumCacheTTL: 120,
    remotePatterns: [
      { protocol: 'https', hostname: '**.pinata.cloud' },
      { protocol: 'https', hostname: '**.ipfs.nftstorage.link' },
      { protocol: 'https', hostname: '**.ipfs.dweb.link' },
      { protocol: 'https', hostname: '**.arweave.net' },
      { protocol: 'https', hostname: 'arweave.net' },
      { protocol: 'https', hostname: 'cf-ipfs.com' },
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: 'gateway.ipfs.io' },
      { protocol: 'https', hostname: 'gateway.pinata.cloud' },
      { protocol: 'https', hostname: 'cdn.helius-rpc.com' },
      { protocol: 'https', hostname: 'image.thum.io' },
      { protocol: 'https', hostname: 'pump.mypinata.cloud' },
      { protocol: 'https', hostname: 'cf-images.helius-rpc.com' },
      { protocol: 'https', hostname: 'shdw-drive.genesysgo.net' },
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: 'pbs.twimg.com' },
      { protocol: 'https', hostname: 'imagedelivery.net' },
      { protocol: 'https', hostname: 'static.jup.ag' },
    ],
  },

  // Keep server-side imports of the Solana SDK external to avoid bundling
  // the full library into every API route.
  serverExternalPackages: ['@solana/web3.js', '@solana/spl-token', 'helius-sdk'],
};

const sentryOrg = process.env.SENTRY_ORG?.trim();
const sentryProject = process.env.SENTRY_PROJECT?.trim();
const sentryBuildEnabled =
  Boolean(process.env.SENTRY_AUTH_TOKEN?.trim()) && Boolean(sentryOrg && sentryProject);

export default sentryBuildEnabled
  ? withSentryConfig(nextConfig, {
      org: sentryOrg,
      project: sentryProject,
      silent: true,
      disableLogger: true,
      widenClientFileUpload: true,
      sourcemaps: {
        // Default upload behavior deletes maps after upload (no public map exposure).
        deleteSourcemapsAfterUpload: true,
      },
    })
  : nextConfig;
