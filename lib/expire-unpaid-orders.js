import { query } from './db';
import { findByCode } from './orders';
import { cancelAndSyncTransaction } from './midtrans';
import { PAYMENT_WINDOW_MINUTES } from './payments';
import { sendOrderEmail } from './mailer';

async function sendClaimedCancellationEmail(order) {
  const claim = await query(
    `UPDATE prescriptions SET payment_cancel_email_sent_at = NOW(), updated_at = updated_at
     WHERE id = ? AND payment_cancel_email_sent_at IS NULL AND email IS NOT NULL`,
    [order.id]
  );
  if (!claim.affectedRows) return false;

  const sent = await sendOrderEmail(
    order,
    `Pesanan ${order.order_code} dibatalkan karena belum dibayar`,
    `Pesanan ini dibatalkan otomatis karena pembayaran tidak diterima dalam batas waktu ${PAYMENT_WINDOW_MINUTES} menit. Tautan pembayaran untuk pesanan ini sudah tidak berlaku. Jika masih memerlukan obat, silakan buat pesanan baru. Untuk informasi, hubungi apotek melalui WhatsApp 0895 4002 000203 dan sebutkan kode pesanan.`,
    { path: '/', linkLabel: 'Buat pesanan baru' }
  );
  if (sent) return true;

  await query(
    `UPDATE prescriptions SET payment_cancel_email_sent_at = NULL, updated_at = updated_at
     WHERE id = ? AND payment_cancel_email_sent_at IS NOT NULL`,
    [order.id]
  );
  return false;
}

export async function expireUnpaidDeliveryOrders() {
  let autoCancelled = 0;
  let cancellationEmailsSent = 0;
  const overdue = await query(
    `SELECT * FROM prescriptions
     WHERE method = 'DELIVERY' AND status IN ('MENUNGGU_VERIFIKASI', 'DIPROSES_DIRACIK')
       AND payment_status <> 'PAID' AND payment_expires_at <= NOW()
     ORDER BY payment_expires_at ASC LIMIT 100`
  );

  for (const candidate of overdue) {
    let order = candidate;
    if (candidate.midtrans_order_id && candidate.payment_status === 'PENDING') {
      try {
        await cancelAndSyncTransaction(candidate.midtrans_order_id);
        order = await findByCode(candidate.order_code);
      } catch (error) {
        console.error(`[expireUnpaidDeliveryOrders] Gagal membatalkan transaksi ${candidate.order_code}:`, error);
        continue;
      }
    }

    if (
      !order ||
      order.payment_status === 'PAID' ||
      (order.midtrans_order_id && order.payment_status === 'PENDING')
    ) continue;

    const result = await query(
      `UPDATE prescriptions SET status = 'DIBATALKAN', cancellation_reason = 'Pembayaran ongkir tidak diterima sebelum batas waktu.',
         payment_status = 'EXPIRED', snap_token = NULL, auto_cancelled_at = COALESCE(auto_cancelled_at, NOW())
       WHERE id = ? AND method = 'DELIVERY' AND status IN ('MENUNGGU_VERIFIKASI', 'DIPROSES_DIRACIK')
         AND payment_status <> 'PAID' AND payment_expires_at <= NOW()
         AND (midtrans_order_id IS NULL OR payment_status IN ('EXPIRED', 'FAILED'))`,
      [order.id]
    );
    if (result.affectedRows) autoCancelled++;
  }

  const cancelledOrders = await query(
    `SELECT * FROM prescriptions
     WHERE auto_cancelled_at IS NOT NULL AND payment_cancel_email_sent_at IS NULL
       AND email IS NOT NULL
     ORDER BY auto_cancelled_at ASC LIMIT 100`
  );
  for (const order of cancelledOrders) {
    if (await sendClaimedCancellationEmail(order)) cancellationEmailsSent++;
  }

  return { autoCancelled, cancellationEmailsSent };
}
