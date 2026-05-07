import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils/cn';
import { APP_NAME, APP_TAGLINE } from '@/lib/utils/constants';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  icons: {
    icon: '/favicon.ico',
    apple: '/branding/pointer-mark.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0B0E',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(inter.variable, 'dark')}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-bg-base text-fg-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
