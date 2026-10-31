import { NextResponse } from 'next/server';
import { findByCode, publicOrder } from '@/lib/orders';
import { getTransactionStatus, applyPaymentStatus } from '@/lib/midtrans';

export const dynamic = 'force-dynamic';

// Sinkronisasi manual ke Midtrans. Berguna saat berjalan di localhost,
// karena webhook Midtrans tidak bisa menjangkau komputer lokal tanpa tunnel.
export async function POST(req) {
  try {
    const { orderCode } = await req.json();
    let order = await findByCode(String(orderCode || '').toUpperCase());
    if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });

    if (order.midtrans_order_id && order.payment_status !== 'PAID') {
      const n = await getTransactionStatus(order.midtrans_order_id);
      if (n && n.transaction_status) {
        await applyPaymentStatus({ ...n, order_id: order.midtrans_order_id });
        order = await findByCode(order.order_code);
      }
    }
    return NextResponse.json({ order: publicOrder(order) });
  } catch (e) {
    console.error('[POST /api/payment/sync]', e);
    return NextResponse.json({ error: 'Kesalahan server.' }, { status: 500 });
  }
}
