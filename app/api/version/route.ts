import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Running version + deploy identity — for post-deploy verification, rollback
 *  correlation, and the admin/release surface. Public (no secrets). */
export async function GET() {
  return NextResponse.json({
    version: process.env.NEXT_PUBLIC_POINTER_VERSION?.trim() || '0.1.0',
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 8) || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    deployedAt: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  });
}
