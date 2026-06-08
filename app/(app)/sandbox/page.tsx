'use client';

import { SandboxControlPanel } from '@/components/sandbox/SandboxControlPanel';

export default function SandboxPage() {
  return (
    <div className="h-full min-h-0 w-full overflow-y-auto">
      <SandboxControlPanel />
    </div>
  );
}
