import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { expireUnpaidDeliveryOrders } from '@/lib/expire-unpaid-orders';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (!readSession()) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });

  try {
    const result = await expireUnpaidDeliveryOrders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[POST /api/admin/orders/expire]', error);
    return NextResponse.json({ error: 'Gagal memeriksa batas pembayaran pesanan.' }, { status: 500 });
  }
}
