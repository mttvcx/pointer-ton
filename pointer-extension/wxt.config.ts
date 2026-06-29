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
  manifest: {
    name: 'Pointer',
    short_name: 'Pointer',
    description: 'Crypto intelligence, everywhere you browse. The official Pointer extension.',
    author: 'Pointer',
    permissions: ['storage', 'activeTab', 'scripting'],
    // V1 supported sites — add a site = add a host + an adapter file.
    host_permissions: [
      ...(LOCAL ? ['http://localhost/*', 'http://127.0.0.1/*'] : []),
      'https://x.com/*',
      'https://twitter.com/*',
      'https://dexscreener.com/*',
      'https://solscan.io/*',
      'https://pump.fun/*',
      'https://gmgn.ai/*',
      'https://axiom.trade/*',
      'https://photon-sol.tinyastro.io/*',
      'https://*.bullx.io/*',
      'https://neo.bullx.io/*',
      'https://github.com/*',
    ],
    // Only pointer.trade may message the extension (the connect handshake hands a
    // single-use code in; nothing else can reach the background externally).
    externally_connectable: {
      matches: [
        ...(LOCAL ? ['http://localhost/*'] : []),
        'https://pointer.trade/*',
        'https://*.pointer.trade/*',
      ],
    },
    // No remote code; UI runs from the packaged bundle only.
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
    action: { default_title: 'Pointer' },
  },
});
