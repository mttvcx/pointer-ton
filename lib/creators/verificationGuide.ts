import type { CreatorPlatform } from '@/lib/creators/config';

export type VerificationGuide = {
  platformLabel: string;
  analyticsPath: string;
  exampleVideoSrc: string;
  steps: string[];
};

const TUTORIALS = {
  tiktok: '/creators/tutorials/tt-audience-tutorial.mp4',
  instagram: '/creators/tutorials/ig-audience-tutorial.mp4',
  x: '/creators/tutorials/tt-audience-tutorial.mp4',
} as const;

export function verificationExampleVideo(platform: CreatorPlatform): string {
  const fromEnv =
    platform === 'tiktok'
      ? process.env.NEXT_PUBLIC_CREATOR_VERIFICATION_EXAMPLE_TT
      : platform === 'instagram'
        ? process.env.NEXT_PUBLIC_CREATOR_VERIFICATION_EXAMPLE_IG
        : process.env.NEXT_PUBLIC_CREATOR_VERIFICATION_EXAMPLE_X;
  if (fromEnv?.trim()) return fromEnv.trim();
  return TUTORIALS[platform];
}

export function verificationGuideFor(platform: CreatorPlatform): VerificationGuide {
  switch (platform) {
    case 'tiktok':
      return {
        platformLabel: 'TikTok',
        analyticsPath: 'TikTok Studio → Analytics → Viewers → Locations (last 28 days)',
        exampleVideoSrc: verificationExampleVideo('tiktok'),
        steps: [
          'Open TikTok Studio on the phone you post from.',
          'Go to Analytics → Viewers and open Locations for the last 28 days.',
          'Grab a second phone and physically record your screen — one continuous clip, no cuts.',
          'Show the full demographics view scrolling if needed — keep it uncut.',
          'Upload that MP4/MOV file here (max 50MB).',
        ],
      };
    case 'instagram':
      return {
        platformLabel: 'Instagram',
        analyticsPath: 'Instagram → Professional dashboard → Insights → Audience → Top locations (28 days)',
        exampleVideoSrc: verificationExampleVideo('instagram'),
        steps: [
          'Open Instagram Professional dashboard on the phone you post from.',
          'Navigate to Insights → Audience and open top locations for the last 28 days.',
          'Use a second phone to film your screen — not a screen recording.',
          'Keep the camera rolling in one continuous take while you show the data.',
          'Upload that MP4/MOV file here (max 50MB).',
        ],
      };
    case 'x':
      return {
        platformLabel: 'X',
        analyticsPath: 'X Analytics → Audience → Country/region breakdown (28 days)',
        exampleVideoSrc: verificationExampleVideo('x'),
        steps: [
          'Open X Analytics on the device you post from.',
          'Show audience location / country breakdown for the last 28 days.',
          'Film with a second phone pointed at your screen — physical recording only.',
          'One continuous clip — no screen recorder, no editing.',
          'Upload that MP4/MOV file here (max 50MB).',
        ],
      };
  }
}

export const VERIFICATION_REJECT_RULES = [
  'Screen recordings are rejected — we can tell.',
  'Edited or cut clips are rejected — must be one continuous take.',
  'Accounts below 20% Tier-1 audience are not approved.',
] as const;

export function verificationStatusLabel(status: string): string {
  switch (status) {
    case 'needs_verification':
      return 'Needs verification';
    case 'pending':
      return 'Under review';
    case 'verified':
      return 'Verified';
    case 'rejected':
      return 'Rejected';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function verificationStatusTone(
  status: string,
): 'warn' | 'pending' | 'ok' | 'bad' | 'muted' {
  switch (status) {
    case 'needs_verification':
      return 'warn';
    case 'pending':
      return 'pending';
    case 'verified':
      return 'ok';
    case 'rejected':
      return 'bad';
    default:
      return 'muted';
  }
}
