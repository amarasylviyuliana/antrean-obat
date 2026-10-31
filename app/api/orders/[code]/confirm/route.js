import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { deliveryEta } from '@/lib/geo';
import { STATUS_LABEL } from '@/lib/constants';
import { findByCode, publicOrder } from '@/lib/orders';
import { sendOrderEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function POST(_req, { params }) {
  try {
    const order = await findByCode(String(params.code || '').toUpperCase());
    if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    if (order.method !== 'DELIVERY') {
      return NextResponse.json({ error: 'Konfirmasi penerimaan hanya tersedia untuk pesanan antar.' }, { status: 400 });
    }
    if (order.status === 'SELESAI') {
      return NextResponse.json({ ok: true, order: publicOrder(order) });
    }
    if (order.status !== 'DISERAHKAN_KURIR') {
      return NextResponse.json({ error: 'Pesanan belum diserahkan kepada kurir.' }, { status: 400 });
    }

    const eta = deliveryEta(order.updated_at, order.distance_km);
    if (eta === null) {
      console.error(`[POST /api/orders/code/confirm] Invalid delivery ETA for ${order.order_code}`);
      return NextResponse.json({ error: 'Estimasi pengantaran tidak dapat dihitung.' }, { status: 500 });
    }
    if (Date.now() < eta) {
      return NextResponse.json({ error: 'Konfirmasi tersedia setelah estimasi pengantaran tercapai.' }, { status: 400 });
    }

    const result = await query(
      `UPDATE prescriptions
       SET status = 'SELESAI'
       WHERE id = ? AND status = 'DISERAHKAN_KURIR'`,
      [order.id]
    );
    const updated = await findByCode(order.order_code);
    if (!result.affectedRows && updated.status !== 'SELESAI') {
      return NextResponse.json({ error: 'Status pesanan berubah. Muat ulang halaman dan coba lagi.' }, { status: 409 });
    }
    if (result.affectedRows) {
      sendOrderEmail(
        updated,
        `Status pesanan obat ${updated.order_code}: ${STATUS_LABEL.SELESAI}`,
        'Pasien telah mengonfirmasi bahwa obat sudah diterima. Terima kasih!'
      );
    }
    return NextResponse.json({ ok: true, order: publicOrder(updated) });
  } catch (e) {
    console.error('[POST /api/orders/code/confirm]', e);
    return NextResponse.json({ error: 'Kesalahan server.' }, { status: 500 });
  }
}
