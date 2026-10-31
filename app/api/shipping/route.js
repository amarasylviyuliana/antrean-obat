import { NextResponse } from 'next/server';
import { calcShipping, OUT_OF_RANGE_MSG } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { lat, lng } = await req.json().catch(() => ({}));
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)))
    return NextResponse.json({ error: 'Koordinat tidak valid.' }, { status: 400 });
  const r = calcShipping(Number(lat), Number(lng));
  return NextResponse.json({ ...r, message: r.within ? null : OUT_OF_RANGE_MSG });
}
