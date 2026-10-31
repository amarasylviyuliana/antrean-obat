import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { STATUS_LABEL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!readSession()) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  try {
    const searchParams = new URL(req.url).searchParams;
    const requestedStatus = searchParams.get('status');
    const status = STATUS_LABEL[requestedStatus] ? requestedStatus : null;
    const requestedPage = Number.parseInt(searchParams.get('page') || '1', 10);
    const pageSize = 10;
    const safePage = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
    const conditions = ["(status <> 'SELESAI' OR updated_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR))"];
    const params = [];
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    const where = ` WHERE ${conditions.join(' AND ')}`;
    const sql = `SELECT * FROM prescriptions${where}`;
    const countSql = `SELECT COUNT(*) AS total FROM prescriptions${where}`;
    const totals = await query(countSql, params);
    const total = Number(totals[0].total);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(safePage, pageCount);
    const pageParams = [...params, pageSize, (page - 1) * pageSize];
    const [orders, counts] = await Promise.all([
      query(`${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`, pageParams),
      query(
        `SELECT status, COUNT(*) AS c FROM prescriptions
         WHERE status <> 'SELESAI' OR updated_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         GROUP BY status`
      ),
    ]);
    return NextResponse.json({ orders, counts, pagination: { page, pageSize, total, pageCount } });
  } catch (e) {
    console.error('[GET /api/admin/orders]', e);
    return NextResponse.json({ error: 'Kesalahan server.' }, { status: 500 });
  }
}
