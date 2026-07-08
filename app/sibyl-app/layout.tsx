import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sibyl — private AI',
  description: 'Sibyl by Pointer — a private AI. Ask anything; crypto intelligence on tap.',
  manifest: '/sibyl-app.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Sibyl' },
  icons: { apple: '/sibyl-app-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#07080c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

/**
 * Standalone Sibyl app shell. Self-contained dark theme (the /sibyl dashboard's
 * `s-*` classes live inside its own component, so this app defines its own) —
 * Venice-clean, mobile-first, liquid glass. General AI by default; the Crypto
 * specialty (the Council) lives behind the Specialties tab.
 */
export default function SibylAppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="sib">
      <style>{THEME}</style>
      {children}
    </div>
  );
}

const THEME = `
.sib{
  --sib-bg:#07080c; --sib-bg2:#0b0d13;
  --sib-panel:rgba(255,255,255,0.045); --sib-panel2:rgba(255,255,255,0.08);
  --sib-glass:rgba(17,20,28,0.55); --sib-border:rgba(255,255,255,0.09);
  --sib-fg:#eef1f8; --sib-muted:#9aa2b1; --sib-faint:#626a78;
  --sib-accent:#6d5efc; --sib-accent2:#22d3ee;
  --sib-veil:#a855f7;
  /* s-* compatibility so reused Sibyl components (SibylAnswerView/Cards) theme correctly */
  --s-accent:#6d5efc; --s-panel-2:rgba(255,255,255,0.08); --s-border:rgba(255,255,255,0.09);
  --s-fg:#eef1f8; --s-muted:#9aa2b1; --s-faint:#626a78;
  color:var(--sib-fg);
  font-feature-settings:'ss01';
}
.sib .s-fg{color:var(--s-fg)} .sib .s-muted{color:var(--s-muted)} .sib .s-faint{color:var(--s-faint)}
.sib .s-panel2{background:var(--s-panel-2)} .sib .s-accent{color:var(--s-accent)} .sib .s-border{border-color:var(--s-border)}
.sib-fg{color:var(--sib-fg)} .sib-muted{color:var(--sib-muted)} .sib-faint{color:var(--sib-faint)}
.sib-accent{color:var(--sib-accent)}
.sib-panel{background:var(--sib-panel)} .sib-panel2{background:var(--sib-panel2)}
.sib-border{border-color:var(--sib-border)}
.sib-glass{background:var(--sib-glass);-webkit-backdrop-filter:blur(26px) saturate(1.6);backdrop-filter:blur(26px) saturate(1.6);border:1px solid var(--sib-border)}
.sib-hover:hover{background:var(--sib-panel2)}
.sib-tag-anon{background:rgba(34,211,238,0.14);color:#67e8f9}
.sib-tag-veil{background:rgba(168,85,247,0.16);color:#d8b4fe}
@keyframes sib-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.sib-rise{animation:sib-fade .32s cubic-bezier(.22,.61,.36,1) both}
@keyframes sib-dots{0%,80%,100%{opacity:.25}40%{opacity:1}}
.sib-dot{animation:sib-dots 1.2s infinite}
`;
