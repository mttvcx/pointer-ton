import { CopilotEmbeddedPanel } from '@/components/_design/CopilotEmbeddedPanel';

export const metadata = {
  title: 'Co-pilot sketch (design)',
};

/**
 * /design/copilot-sketch — visual prototype of the always-expanded,
 * hard-embedded co-pilot panel (Cluely-style). NOT wired to real co-pilot
 * APIs. Lives at its own route so the look can be reviewed before we
 * replace the small pill anywhere in production.
 *
 * Folder is `design/` (not `_design/`) because Next.js App Router treats
 * any folder starting with `_` as private / non-routable.
 */
export default function CopilotSketchPage() {
  return (
    <div className="min-h-[calc(100dvh-var(--app-topbar-h)-var(--app-bottombar-h))] bg-bg-base p-6">
      <div className="mb-4 rounded-md border border-signal-warn/30 bg-signal-warn/10 px-3 py-2 text-xs text-signal-warn">
        <strong>DESIGN SKETCH</strong> — visual prototype only, not wired to real
        co-pilot. Review the look, then approve before we build it for real.
      </div>

      <h1 className="mb-2 text-xl font-bold text-fg-primary">
        Co-pilot embedded panel — Cluely-style
      </h1>
      <p className="mb-8 max-w-2xl text-sm text-fg-muted">
        Always-expanded, hard-embedded into the top center of the app. Replaces
        the small one-line pill. Has a quick action row, last AI answer always
        visible, and a chat input. Side panel mode remains optional via the
        &quot;Tab to side&quot; button.
      </p>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-raised">
        <div className="flex items-center gap-4 border-b border-border-subtle px-4 py-2">
          <span className="text-sm font-semibold text-fg-primary">pointer.</span>
          <nav className="flex gap-3 text-xs text-fg-secondary">
            <span className="text-fg-primary">Pulse</span>
            <span>Explore</span>
            <span>Perps</span>
            <span>Portfolio</span>
            <span>Track</span>
            <span>Squads</span>
            <span>Points</span>
          </nav>
          <div className="ml-auto flex items-center gap-2 text-xs text-fg-muted">
            <span>Search</span>
            <span>·</span>
            <span>Deposit</span>
            <span>·</span>
            <span>0 SOL</span>
          </div>
        </div>

        <CopilotEmbeddedPanel />

        <div className="px-4 py-8 text-xs text-fg-muted">
          [Pulse columns would render here]
        </div>
      </div>
    </div>
  );
}
