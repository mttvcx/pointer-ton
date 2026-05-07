import { NextResponse } from 'next/server';

/** TonConnect manifest — served over HTTP so wallet apps can load metadata. */
export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://127.0.0.1:3001';
  return NextResponse.json({
    url: base,
    name: 'Pointer TON',
    iconUrl: `${base}/branding/logo.svg`,
  });
}
