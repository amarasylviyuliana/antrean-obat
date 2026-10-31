import { NextResponse } from 'next/server';
import { findByCode, publicOrder } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  try {
    const order = await findByCode(String(params.code || '').toUpperCase());
    if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ order: publicOrder(order) });
  } catch (e) {
    console.error('[GET /api/orders/code]', e);
    return NextResponse.json({ error: 'Kesalahan server.' }, { status: 500 });
  }
}
