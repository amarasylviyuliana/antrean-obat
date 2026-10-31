import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parseDateTime } from '@/lib/format';
import { findByCode } from '@/lib/orders';
import { createSnapTransaction } from '@/lib/midtrans';
import { PAYMENT_WINDOW_MINUTES } from '@/lib/payments';

export const dynamic = 'force-dynamic';

function jakartaTimestamp(date) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${parts.replace('T', ' ')} +0700`;
}

export async function POST(req) {
  try {
    const { orderCode } = await req.json();
    const order = await findByCode(String(orderCode || '').toUpperCase());
    if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    if (order.method !== 'DELIVERY' || order.shipping_fee <= 0)
      return NextResponse.json({ error: 'Pesanan ini tidak memerlukan pembayaran.' }, { status: 400 });
    if (order.status === 'DIBATALKAN')
      return NextResponse.json({ error: 'Pesanan sudah dibatalkan.' }, { status: 400 });
    if (order.payment_status === 'PAID')
      return NextResponse.json({ error: 'Pesanan sudah dibayar.' }, { status: 400 });
    const paymentExpiresAt = parseDateTime(order.payment_expires_at);
    if (!paymentExpiresAt || Date.now() >= paymentExpiresAt.getTime()) {
      return NextResponse.json(
        { error: `Batas waktu pembayaran ${PAYMENT_WINDOW_MINUTES} menit sudah lewat. Pesanan akan dibatalkan otomatis.` },
        { status: 400 }
      );
    }

    // Token Snap yang masih menunggu pembayaran dipakai ulang
    if (order.payment_status === 'PENDING' && order.snap_token && order.midtrans_order_id) {
      return NextResponse.json({ token: order.snap_token });
    }

    const now = Date.now();
    const remainingMinutes = Math.max(1, Math.ceil((paymentExpiresAt.getTime() - now) / 60000));
    const midtransOrderId = `${order.order_code}-${now.toString(36)}`;
    const snap = await createSnapTransaction({
      transaction_details: { order_id: midtransOrderId, gross_amount: Number(order.shipping_fee) },
      expiry: {
        start_time: jakartaTimestamp(new Date(now)),
        unit: 'minutes',
        duration: Math.min(PAYMENT_WINDOW_MINUTES, remainingMinutes),
      },
      item_details: [
        {
          id: 'ONGKIR',
          price: Number(order.shipping_fee),
          quantity: 1,
          name: `Ongkir antar obat (${order.distance_km} km)`.slice(0, 50),
        },
      ],
      customer_details: {
        first_name: order.patient_name,
        phone: order.phone,
        ...(order.email ? { email: order.email } : {}),
      },
    });

    const saved = await query(
      `UPDATE prescriptions SET midtrans_order_id=?, snap_token=?, payment_status='PENDING'
       WHERE id=? AND payment_status<>'PAID' AND status<>'DIBATALKAN'
         AND payment_expires_at > NOW()`,
      [midtransOrderId, snap.token, order.id]
    );
    if (!saved.affectedRows) {
      return NextResponse.json(
        { error: 'Batas waktu pembayaran sudah lewat atau status pesanan berubah. Muat ulang halaman pesanan.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ token: snap.token });
  } catch (e) {
    console.error('[POST /api/payment/token]', e);
    return NextResponse.json({ error: e.message || 'Gagal membuat pembayaran.' }, { status: 500 });
  }
}
