import { defineConfig } from 'wxt';

// Local test builds (EXT_LOCAL=1) add localhost so the extension can reach a dev
// pointer-ton at :3001 and complete the connect handshake. NEVER in store builds.
const LOCAL = process.env.EXT_LOCAL === '1';

// Pointer extension manifest (MV3). Security posture: no remote code, no eval,
// strict CSP, least-privilege host permissions. The background service worker is
// the ONLY thing that talks to the Pointer API (`/api/ext/*`).
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // API base is deterministic per build mode (overrides any committed .env): local
  // dev → :3001, everything else → pointer.am (the live canonical domain). Prevents
  // a store/prod build from accidentally shipping localhost.
  vite: () => ({
    define: {
      'import.meta.env.VITE_POINTER_API_BASE': JSON.stringify(LOCAL ? 'http://localhost:3001' : 'https://pointer.am'),
    },
  }),
  manifest: {
    name: 'Pointer',
    short_name: 'Pointer',
    description: 'Crypto intelligence, everywhere you browse. The official Pointer extension.',
    author: 'Pointer',
    permissions: ['storage', 'downloads', 'sidePanel'],
    // Toolbar / management-page icon (the bird). Chrome scales the one source.
    icons: {
      16: 'pointer-bird.png',
      32: 'pointer-bird.png',
      48: 'pointer-bird.png',
      128: 'pointer-bird.png',
    },
    // V1 supported sites — add a site = add a host + an adapter file.
    host_permissions: [
      ...(LOCAL ? ['http://localhost/*', 'http://127.0.0.1/*'] : []),
      // Pointer's own API — the background worker fetches /api/ext here.
      'https://pointer.am/*',
      'https://*.pointer.am/*',
      'https://pointer-ton-orcin.vercel.app/*',
      'https://pointer.trade/*',
      'https://*.pointer.trade/*',
      // The site with a content-script adapter today. Add more hosts as adapters ship.
      'https://x.com/*',
      'https://twitter.com/*',
    ],
    // Only Pointer's own domains may message the extension (the connect handshake
    // hands a single-use code in; nothing else can reach the background externally).
    externally_connectable: {
      matches: [
        ...(LOCAL ? ['http://localhost/*'] : []),
        'https://pointer.am/*',
        'https://*.pointer.am/*',
        'https://pointer-ton-orcin.vercel.app/*',
        'https://pointer.trade/*',
        'https://*.pointer.trade/*',
      ],
    },
    // The hover-card Shadow DOM loads the Pointer logo + Geist font from the
    // packaged bundle (no remote assets).
    web_accessible_resources: [
      {
        resources: ['pointer-bird.png', 'geist.woff2'],
        matches: ['https://x.com/*', 'https://twitter.com/*'],
      },
    ],
    // No remote code; UI runs from the packaged bundle only.
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
    action: { default_title: 'Pointer', default_icon: { 16: 'pointer-bird.png', 32: 'pointer-bird.png', 48: 'pointer-bird.png' } },
  },
});
