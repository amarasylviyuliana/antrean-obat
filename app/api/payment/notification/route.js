import { NextResponse } from 'next/server';
import { verifySignature, applyPaymentStatus } from '@/lib/midtrans';

export const dynamic = 'force-dynamic';

// Webhook Midtrans (Payment Notification URL): settlement, pending, cancel, expire, dll.
export async function POST(req) {
  try {
    const n = await req.json();
    if (!verifySignature(n)) {
      return NextResponse.json({ error: 'Signature tidak valid.' }, { status: 403 });
    }
    const status = await applyPaymentStatus(n);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    console.error('[POST /api/payment/notification]', e);
    return NextResponse.json({ error: 'Kesalahan server.' }, { status: 500 });
  }
}
