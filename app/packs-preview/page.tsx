import { Pack3DLazy } from '@/components/packs/Pack3DLazy';

export const dynamic = 'force-dynamic';

/** TEMP dev preview — unauthenticated, for reviewing the 3D pack render. Remove before ship. */
const TIERS = ['bronze', 'silver', 'gold', 'legendary'] as const;

export default function PacksPreviewPage() {
  return (
    <div style={{ minHeight: '100dvh', background: '#07080c', padding: '40px 24px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <h1 style={{ color: '#eef1f8', fontFamily: 'Arial Narrow, sans-serif', fontWeight: 800, fontSize: 48, letterSpacing: '.01em' }}>
          Pointer Packs — 3D
        </h1>
        <p style={{ color: '#8a90a4', fontSize: 14, marginTop: 6 }}>Real WebGL foil packs. Move your mouse across one.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 28, marginTop: 40 }}>
          {TIERS.map((t) => (
            <div key={t} style={{ height: 380 }}>
              <Pack3DLazy type={t} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
