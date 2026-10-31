import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { deliveryEta } from '@/lib/geo';
import { STATUS_LABEL } from '@/lib/constants';
import { query } from '@/lib/db';
import { findByCode } from '@/lib/orders';
import { sendOrderEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function POST(_req, { params }) {
  const token = cookies().get('antreobat_courier')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json({ error: 'Sesi kurir tidak ditemukan. Muat ulang halaman kurir.' }, { status: 401 });
  }

  try {
    const code = String(params.code || '').toUpperCase();
    const order = await findByCode(code);
    if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    if (order.method !== 'DELIVERY' || order.status !== 'DISERAHKAN_KURIR') {
      return NextResponse.json({ error: 'Pesanan ini tidak sedang dalam pengantaran.' }, { status: 409 });
    }
    if (order.courier_claim_token !== token) {
      return NextResponse.json({ error: 'Pesanan ini bukan tugas yang Anda klaim.' }, { status: 403 });
    }

    const eta = deliveryEta(order.updated_at, order.distance_km);
    if (eta === null) {
      console.error(`[POST /api/kurir/orders/code/complete] Invalid delivery ETA for ${order.order_code}`);
      return NextResponse.json({ error: 'Estimasi pengantaran tidak dapat dihitung.' }, { status: 500 });
    }
    if (Date.now() < eta) {
      return NextResponse.json(
        { error: 'Pengiriman belum bisa diselesaikan sebelum estimasi waktu pengantaran tercapai.' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE prescriptions SET status = 'SELESAI'
       WHERE id = ? AND method = 'DELIVERY' AND status = 'DISERAHKAN_KURIR'
         AND courier_claim_token = ?`,
      [order.id, token]
    );
    if (result.affectedRows !== 1) {
      return NextResponse.json({ error: 'Status pesanan berubah. Muat ulang halaman dan coba lagi.' }, { status: 409 });
    }

    const updated = await findByCode(order.order_code);
    sendOrderEmail(
      updated,
      `Status pesanan obat ${updated.order_code}: ${STATUS_LABEL.SELESAI}`,
      'Pesanan Anda telah diantar oleh kurir. Semoga lekas sembuh!'
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[POST /api/kurir/orders/code/complete]', e);
    return NextResponse.json({ error: 'Gagal menyelesaikan pengiriman.' }, { status: 500 });
  }
}
