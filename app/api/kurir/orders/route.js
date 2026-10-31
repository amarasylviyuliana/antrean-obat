import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const COURIER_COOKIE = 'antreobat_courier';

function courierToken() {
  const store = cookies();
  let token = store.get(COURIER_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = randomBytes(32).toString('hex');
    store.set(COURIER_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return token;
}

export async function GET() {
  try {
    const token = courierToken();
    const [available, mine] = await Promise.all([
      query(
        `SELECT order_code, queue_number, patient_name, phone, kota, kecamatan,
                kelurahan, address_detail, lat, lng, distance_km, shipping_fee, created_at, updated_at
         FROM prescriptions
         WHERE method = 'DELIVERY' AND status = 'DISERAHKAN_KURIR'
           AND payment_status = 'PAID' AND courier_claim_token IS NULL
         ORDER BY created_at ASC`
      ),
      query(
        `SELECT order_code, queue_number, patient_name, phone, kota, kecamatan,
                kelurahan, address_detail, lat, lng, distance_km, shipping_fee, created_at,
                courier_claimed_at, updated_at, status
         FROM prescriptions
         WHERE method = 'DELIVERY' AND status IN ('DISERAHKAN_KURIR', 'SELESAI')
           AND courier_claim_token = ?
           AND (status = 'DISERAHKAN_KURIR' OR updated_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR))
         ORDER BY courier_claimed_at ASC`,
        [token]
      ),
    ]);
    return NextResponse.json({ available, mine });
  } catch (e) {
    console.error('[GET /api/kurir/orders]', e);
    return NextResponse.json({ error: 'Gagal memuat daftar tugas kurir.' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { orderCode } = await req.json();
    const code = String(orderCode || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{1,24}$/.test(code)) {
      return NextResponse.json({ error: 'Kode pesanan tidak valid.' }, { status: 400 });
    }
    const token = courierToken();
    const result = await query(
      `UPDATE prescriptions
       SET courier_claim_token = ?, courier_claimed_at = NOW(), updated_at = updated_at
       WHERE order_code = ? AND method = 'DELIVERY' AND status = 'DISERAHKAN_KURIR'
         AND payment_status = 'PAID' AND courier_claim_token IS NULL`,
      [token, code]
    );
    if (result.affectedRows !== 1) {
      return NextResponse.json(
        { error: 'Pesanan sudah diklaim kurir lain atau tidak tersedia lagi.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[POST /api/kurir/orders]', e);
    return NextResponse.json({ error: 'Gagal mengklaim pesanan.' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { orderCode } = await req.json();
    const code = String(orderCode || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{1,24}$/.test(code)) {
      return NextResponse.json({ error: 'Kode pesanan tidak valid.' }, { status: 400 });
    }
    const token = courierToken();
    const result = await query(
      `UPDATE prescriptions
       SET courier_claim_token = NULL, courier_claimed_at = NULL, updated_at = updated_at
       WHERE order_code = ? AND method = 'DELIVERY' AND status = 'DISERAHKAN_KURIR'
         AND courier_claim_token = ?`,
      [code, token]
    );
    if (result.affectedRows !== 1) {
      return NextResponse.json(
        { error: 'Pesanan tidak ditemukan dalam tugas yang Anda klaim.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/kurir/orders]', e);
    return NextResponse.json({ error: 'Gagal melepas pesanan.' }, { status: 500 });
  }
}
