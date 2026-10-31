import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { findByCode } from '@/lib/orders';
import { deliveryEta } from '@/lib/geo';
import { flowFor, STATUS_LABEL } from '@/lib/constants';
import { sendOrderEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const EMAIL_INTRO = {
  DIPROSES_DIRACIK: 'Resep Anda sudah diverifikasi dan obat sedang diracik oleh apoteker.',
  SIAP_DIAMBIL: 'Obat Anda sudah siap. Silakan ambil di apotek klinik sesuai jam yang Anda pilih.',
  DISERAHKAN_KURIR: 'Obat Anda sudah diserahkan ke kurir dan sedang dalam perjalanan ke alamat Anda.',
  SELESAI: 'Pesanan obat Anda telah selesai. Semoga lekas sembuh!',
  DIBATALKAN: 'Mohon maaf, pesanan obat Anda dibatalkan. Hubungi apotek klinik untuk informasi lebih lanjut.',
};

export async function PATCH(req, { params }) {
  if (!readSession()) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  try {
    const { status } = await req.json();
    if (!STATUS_LABEL[status]) return NextResponse.json({ error: 'Status tidak valid.' }, { status: 400 });

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

    await query(
      'UPDATE prescriptions SET status = ?, courier_claim_token = NULL, courier_claimed_at = NULL WHERE id = ?',
      [status, order.id]
    );
    const updated = await findByCode(order.order_code);
    if (EMAIL_INTRO[status]) {
      sendOrderEmail(updated, `Status pesanan obat ${updated.order_code}: ${STATUS_LABEL[status]}`, EMAIL_INTRO[status]);
    }
    return NextResponse.json({ ok: true, order: updated });
  } catch (e) {
    console.error('[PATCH /api/admin/orders/code]', e);
    return NextResponse.json({ error: 'Kesalahan server.' }, { status: 500 });
  }
}
