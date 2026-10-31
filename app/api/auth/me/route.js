import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = readSession();
  if (!s) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: s });
}
