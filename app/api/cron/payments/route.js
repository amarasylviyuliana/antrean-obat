import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { findByCode } from '@/lib/orders';
import { getTransactionStatus, applyPaymentStatus } from '@/lib/midtrans';
import { formatDateTime } from '@/lib/format';
import { PAYMENT_REMINDER_MINUTES } from '@/lib/payments';
import { sendOrderEmail } from '@/lib/mailer';
import { expireUnpaidDeliveryOrders } from '@/lib/expire-unpaid-orders';

export const dynamic = 'force-dynamic';

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret || ''}`;
  const actualBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return Boolean(secret) &&
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

async function refreshPayment(order) {
  if (!order.midtrans_order_id) return order;
  const notification = await getTransactionStatus(order.midtrans_order_id);
  if (!notification?.transaction_status) {
    throw new Error(`Midtrans tidak mengembalikan status transaksi ${order.order_code}.`);
  }
  await applyPaymentStatus({ ...notification, order_id: order.midtrans_order_id });
  return findByCode(order.order_code);
}

async function sendClaimedEmail(order, claimColumn, subject, intro, options) {
  const claim = await query(
    `UPDATE prescriptions SET ${claimColumn} = NOW(), updated_at = updated_at
     WHERE id = ? AND ${claimColumn} IS NULL AND email IS NOT NULL`,
    [order.id]
  );
  if (!claim.affectedRows) return false;

  const sent = await sendOrderEmail(order, subject, intro, options);
  if (!sent) {
    await query(
      `UPDATE prescriptions SET ${claimColumn} = NULL, updated_at = updated_at
       WHERE id = ? AND ${claimColumn} IS NOT NULL`,
      [order.id]
    );
    return false;
  }
  return true;
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });

  try {
    let remindersSent = 0;
    const reminders = await query(
      `SELECT * FROM prescriptions
       WHERE method = 'DELIVERY' AND status IN ('MENUNGGU_VERIFIKASI', 'DIPROSES_DIRACIK')
         AND payment_status <> 'PAID' AND email IS NOT NULL
         AND payment_reminder_sent_at IS NULL
         AND payment_expires_at > NOW()
         AND payment_expires_at <= DATE_ADD(NOW(), INTERVAL ${PAYMENT_REMINDER_MINUTES} MINUTE)
       ORDER BY payment_expires_at ASC LIMIT 100`
    );

    for (const candidate of reminders) {
      let order;
      try {
        order = await refreshPayment(candidate);
      } catch (e) {
        console.error(`[POST /api/cron/payments] Gagal memeriksa pembayaran ${candidate.order_code}:`, e.message);
        continue;
      }
      if (
        !order ||
        order.payment_status === 'PAID' ||
        !['MENUNGGU_VERIFIKASI', 'DIPROSES_DIRACIK'].includes(order.status)
      ) continue;

      const sent = await sendClaimedEmail(
        order,
        'payment_reminder_sent_at',
        `Pengingat pembayaran pesanan ${order.order_code}`,
        `Batas pembayaran ongkir Anda adalah ${formatDateTime(order.payment_expires_at)}. Segera buka halaman pesanan dan selesaikan pembayaran. Jika belum dibayar dalam ${PAYMENT_REMINDER_MINUTES} menit ke depan, pesanan akan dibatalkan otomatis.`,
        { linkLabel: 'Buka pesanan dan bayar' }
      );
      if (sent) remindersSent++;
    }

    const { autoCancelled, cancellationEmailsSent } = await expireUnpaidDeliveryOrders();

    return NextResponse.json({ ok: true, remindersSent, autoCancelled, cancellationEmailsSent });
  } catch (e) {
    console.error('[POST /api/cron/payments]', e);
    return NextResponse.json({ error: 'Gagal memproses pengingat dan kedaluwarsa pembayaran.' }, { status: 500 });
  }
}
