import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { findByCode } from '@/lib/orders';
import { deliveryEta } from '@/lib/geo';
import { flowFor, STATUS_LABEL } from '@/lib/constants';
import { sendOrderEmail } from '@/lib/mailer';
import { cancelAndSyncTransaction } from '@/lib/midtrans';

export const dynamic = 'force-dynamic';

const EMAIL_INTRO = {
  DIPROSES_DIRACIK: 'Resep Anda sudah diverifikasi dan obat sedang diracik oleh apoteker.',
  SIAP_DIAMBIL: 'Obat Anda sudah siap. Silakan ambil di apotek klinik.',
  DISERAHKAN_KURIR: 'Obat Anda sudah diserahkan ke kurir dan sedang dalam perjalanan ke alamat Anda.',
  SELESAI: 'Pesanan obat Anda telah selesai. Semoga lekas sembuh!',
  DIBATALKAN: 'Mohon maaf, pesanan obat Anda dibatalkan dan tidak perlu dibayar. Alasan pembatalan tercantum di bawah. Jika perlu informasi lebih lanjut, hubungi apotek melalui WhatsApp 0895 4002 000203 dan sebutkan kode pesanan.',
};

export async function PATCH(req, { params }) {
  if (!readSession()) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  try {
    const body = (await req.json()) || {};
    const { status } = body;
    const cancellationReason = String(body.cancellationReason || '').trim().slice(0, 255);
    if (!STATUS_LABEL[status]) return NextResponse.json({ error: 'Status tidak valid.' }, { status: 400 });
    if (status === 'DIBATALKAN' && !cancellationReason) {
      return NextResponse.json({ error: 'Alasan pembatalan wajib diisi.' }, { status: 400 });
    }

    const order = await findByCode(params.code);
    if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });

    if (status === order.status) return NextResponse.json({ ok: true, order });

    if (
      status === 'DIBATALKAN' &&
      order.method === 'DELIVERY' &&
      order.status === 'DISERAHKAN_KURIR'
    ) {
      return NextResponse.json(
        { error: 'Pesanan tidak dapat dibatalkan setelah diserahkan kepada kurir.' },
        { status: 400 }
      );
    }

    if (status !== 'DIBATALKAN' && !flowFor(order.method).includes(status)) {
      return NextResponse.json(
        { error: `Status "${STATUS_LABEL[status]}" tidak berlaku untuk metode ${order.method}.` },
        { status: 400 }
      );
    }
    if (order.method === 'DELIVERY' && status === 'SELESAI') {
      if (order.status !== 'DISERAHKAN_KURIR') {
        return NextResponse.json({ error: 'Pesanan harus diserahkan ke kurir terlebih dahulu.' }, { status: 400 });
      }
      const eta = deliveryEta(order.updated_at, order.distance_km);
      if (eta === null) {
        console.error(`[PATCH /api/admin/orders/code] Invalid delivery ETA for ${order.order_code}`);
        return NextResponse.json({ error: 'Estimasi pengantaran tidak dapat dihitung.' }, { status: 500 });
      }
      if (Date.now() < eta) {
        return NextResponse.json(
          { error: 'Pesanan belum bisa diselesaikan sebelum estimasi waktu pengantaran tercapai.' },
          { status: 400 }
        );
      }
    }
    if (order.method === 'DELIVERY' && order.payment_status !== 'PAID' && status !== 'DIBATALKAN' && status !== 'MENUNGGU_VERIFIKASI') {
      return NextResponse.json(
        { error: 'Ongkir belum lunas. Pesanan antar baru bisa diproses setelah pembayaran berhasil.' },
        { status: 400 }
      );
    }

    let warning = null;
    if (
      status === 'DIBATALKAN' &&
      order.method === 'DELIVERY' &&
      order.payment_status === 'PENDING' &&
      order.midtrans_order_id
    ) {
      try {
        const paymentStatus = await cancelAndSyncTransaction(order.midtrans_order_id);
        if (paymentStatus === 'PAID') {
          warning = 'Pembayaran pesanan ini sudah diterima. Informasikan pasien agar menghubungi apotek untuk tindak lanjut pengembalian dana.';
        }
      } catch (paymentError) {
        console.error(`[PATCH /api/admin/orders/code] Gagal membatalkan pembayaran ${order.order_code}:`, paymentError);
        warning = 'Pesanan dibatalkan, tetapi status transaksi pembayaran belum dapat dipastikan. Periksa status di Midtrans.';
      }
    }

    await query(
      `UPDATE prescriptions
       SET status = ?, courier_claim_token = NULL, courier_claimed_at = NULL,
         cancellation_reason = IF(? = 'DIBATALKAN', ?, NULL),
         payment_expires_at = IF(? = 'DIBATALKAN' AND method = 'DELIVERY' AND payment_status <> 'PAID', NULL, payment_expires_at),
         snap_token = IF(? = 'DIBATALKAN' AND method = 'DELIVERY' AND payment_status <> 'PAID', NULL, snap_token),
         payment_status = IF(? = 'DIBATALKAN' AND method = 'DELIVERY' AND payment_status <> 'PAID', 'FAILED', payment_status)
       WHERE id = ?`,
      [status, status, cancellationReason, status, status, status, order.id]
    );
    const updated = await findByCode(order.order_code);
    if (EMAIL_INTRO[status]) {
      const intro = status === 'DIBATALKAN'
        ? `${updated.payment_status === 'PAID'
          ? 'Mohon maaf, pesanan obat Anda dibatalkan setelah pembayaran diterima. Hubungi apotek melalui WhatsApp 0895 4002 000203 untuk informasi pengembalian dana.'
          : EMAIL_INTRO[status]} Alasan pembatalan: ${updated.cancellation_reason}`
        : EMAIL_INTRO[status];
      sendOrderEmail(updated, `Status pesanan obat ${updated.order_code}: ${STATUS_LABEL[status]}`, intro);
    }
    return NextResponse.json({ ok: true, order: updated, warning });
  } catch (e) {
    console.error('[PATCH /api/admin/orders/code]', e);
    return NextResponse.json({ error: 'Kesalahan server.' }, { status: 500 });
  }
}
