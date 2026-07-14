import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { headers } from 'next/headers';
import { cn } from '@/lib/utils/cn';
import { APP_NAME, APP_TAGLINE } from '@/lib/utils/constants';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { PreferencesProvider } from '@/components/preferences/PreferencesProvider';
import { GetAppScreen } from '@/components/mobile/GetAppScreen';
import { getMobilePlatform, isMobileUserAgent } from '@/lib/utils/userAgent';
import { Providers } from './providers';
import './globals.css';

/**
 * Synchronous theme bootstrap.
 *
 * Reads the persisted theme from localStorage and stamps `data-theme` on
 * <html> BEFORE React hydrates, so users never see a flash of the default
 * palette when they have a non-default theme saved. The custom-theme branch
 * additionally inline-applies the user's saved RGB tokens so first paint
 * matches the custom palette. ThemeProvider re-applies on mount.
 *
 * Mirrors the allow-list in `lib/theme/themes.ts` and the schema in
 * `lib/theme/customTheme.ts` — keep these in sync.
 */
const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var d=document.documentElement;var p=location.pathname;if(p==='/'||p.indexOf('/auth')===0||p.indexOf('/beta')===0){d.setAttribute('data-theme','axiom');return;}var t=localStorage.getItem('pointer.theme');if(t==='pointer'||t==='axiom'||t==='terminal'){d.setAttribute('data-theme',t);return;}if(t==='custom'){var raw=localStorage.getItem('pointer.customTheme');if(raw){try{var c=JSON.parse(raw);if(c&&c.colors){d.setAttribute('data-theme','custom');var keys=['bg-base','bg-raised','bg-sunken','bg-hover','border-subtle','border-default','border-strong','fg-primary','fg-secondary','fg-muted','fg-inverse','accent-primary','accent-glow','signal-bull','signal-bear','signal-warn','signal-info'];for(var i=0;i<keys.length;i++){var k=keys[i];var v=c.colors[k];if(typeof v!=='string')continue;v=v.trim();if(/^\\d+\\s+\\d+\\s+\\d+$/.test(v)){d.style.setProperty('--'+k+'-rgb',v);continue;}var hex=v.replace(/^#/,'');if(/^[0-9a-fA-F]{6}$/.test(hex)){var r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);d.style.setProperty('--'+k+'-rgb',r+' '+g+' '+b);}else if(/^[0-9a-fA-F]{3}$/.test(hex)){var r2=parseInt(hex[0]+hex[0],16),g2=parseInt(hex[1]+hex[1],16),b2=parseInt(hex[2]+hex[2],16);d.style.setProperty('--'+k+'-rgb',r2+' '+g2+' '+b2);}}return;}}catch(e){}}}d.setAttribute('data-theme','axiom');}catch(e){document.documentElement.setAttribute('data-theme','axiom');}})();`;

/**
 * Synchronous preferences bootstrap.
 *
 * Reads `pointer.preferences` from localStorage and stamps `data-row-*` /
 * `data-action-divider` / `data-avatar-size` on <html> BEFORE React hydrates,
 * so CSS selectors driven by those attributes (`globals.css` Preferences
 * block) paint correctly on the first frame.
 *
 * The fallbacks here MUST mirror DEFAULT_PREFERENCES in
 * `lib/preferences/preferences.ts` — keep them in sync.
 */
const PREFERENCES_BOOTSTRAP_SCRIPT = `(function(){try{var r=document.documentElement;var raw=localStorage.getItem('pointer.preferences');var p={};if(raw){try{p=JSON.parse(raw)||{};}catch(e){p={};}}r.setAttribute('data-row-density',p.rowDensity==='tabled'?'tabled':'compact');r.setAttribute('data-row-separators',p.rowSeparators===false?'false':'true');r.setAttribute('data-row-elevation',p.rowElevation===false?'false':'true');r.setAttribute('data-action-divider',p.actionZoneDivider===false?'false':'true');r.setAttribute('data-avatar-size',p.avatarSize==='small'||p.avatarSize==='large'?p.avatarSize:'default');}catch(e){}})();`;

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://pointer.am';
const SHARE_TITLE = `${APP_NAME} — Where the sharpest traders are.`;
const SHARE_DESCRIPTION = 'Lowest fees. Best rewards. Fastest execution.';
/** Social/referral unfurl image — served from /public/og. 1280×720. */
const SHARE_IMAGE = '/og/pointer-share.png';

export const metadata: Metadata = {
  // Resolves relative OG/Twitter image paths to absolute URLs (required by
  // X / Discord / Telegram crawlers). Inherited by every route — including
  // referral links — unless a page sets its own metadata.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${APP_NAME} | Where the sharpest traders are.`,
    // Pass-through template so per-page titles render verbatim (no " | Pointer" wrapper).
    // Pages that want the brand suffix must include " | Pointer" themselves.
    template: '%s',
  },
  description: `${APP_NAME} — Where the sharpest traders are.`,
  applicationName: APP_NAME,
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    url: SITE_URL,
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [
      {
        url: SHARE_IMAGE,
        width: 1280,
        height: 720,
        alt: `${APP_NAME} — Where the sharpest traders are.`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0B',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pointer is native-app-first on phones: gate mobile-web visitors to the "get
  // the app" screen (no app JS loads). Bots pass through so SEO + link previews
  // keep working. Server-decided → no flash.
  const ua = (await headers()).get('user-agent');
  const mobile = isMobileUserAgent(ua);

  return (
    <html
      lang="en"
      data-theme="axiom"
      className={cn(geist.variable, 'dark')}
      suppressHydrationWarning
    >
      <head>
        {/* Both scripts must run BEFORE hydration so the persisted theme + */}
        {/* layout preferences paint on the first frame. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_BOOTSTRAP_SCRIPT }} />
        {/* Critical chrome only — the brand mark + the default SOL chain icon are
            above the fold. bnb/base/ton appear only inside the chain dropdown, so
            preloading them (~175KB) just steals first-paint bandwidth from the JS
            that unblocks content. They load on demand when the dropdown opens. */}
        <link rel="preload" href="/branding/pointer-bird.png" as="image" type="image/png" />
        <link rel="preload" href="/chains/sol.png" as="image" type="image/png" />
      </head>
      <body
        className="min-h-screen bg-bg-base text-fg-primary antialiased"
        suppressHydrationWarning
      >
        {mobile ? (
          <GetAppScreen platform={getMobilePlatform(ua)} />
        ) : (
          <PreferencesProvider>
            <ThemeProvider>
              <Providers>{children}</Providers>
            </ThemeProvider>
          </PreferencesProvider>
        )}
      </body>
    </html>
  );
}
