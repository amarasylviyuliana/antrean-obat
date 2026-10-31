import crypto from 'crypto';
import { query } from './db';

const isProd = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const SNAP_URL = isProd
  ? 'https://app.midtrans.com/snap/v1/transactions'
  : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
const API_URL = isProd ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';

function authHeader() {
  return 'Basic ' + Buffer.from(`${process.env.MIDTRANS_SERVER_KEY}:`).toString('base64');
}

export async function createSnapTransaction(body) {
  const res = await fetch(SNAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    const msg = (data.error_messages && data.error_messages.join(', ')) || `HTTP ${res.status}`;
    throw new Error(`Midtrans: ${msg}`);
  }
  return data; // { token, redirect_url }
}

export async function getTransactionStatus(orderId) {
  const res = await fetch(`${API_URL}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { Accept: 'application/json', Authorization: authHeader() },
    cache: 'no-store',
  });
  return res.json().catch(() => ({}));
}

export function verifySignature(n) {
  if (!n || !n.signature_key) return false;
  const expected = crypto
    .createHash('sha512')
    .update(`${n.order_id}${n.status_code}${n.gross_amount}${process.env.MIDTRANS_SERVER_KEY}`)
    .digest('hex');
  return expected === n.signature_key;
}

export function mapPaymentStatus(n) {
  const s = n.transaction_status;
  if (s === 'settlement') return 'PAID';
  if (s === 'capture') return n.fraud_status === 'challenge' ? 'PENDING' : 'PAID';
  if (s === 'pending') return 'PENDING';
  if (s === 'expire') return 'EXPIRED';
  if (s === 'deny' || s === 'cancel' || s === 'failure') return 'FAILED';
  return null;
}

// Terapkan status Midtrans ke database (dipakai webhook dan sinkronisasi manual).
export async function applyPaymentStatus(n) {
  const status = mapPaymentStatus(n);
  if (!status || !n.order_id) return null;
  if (status === 'PAID') {
    await query(
      `UPDATE prescriptions SET payment_status='PAID', paid_at=COALESCE(paid_at, NOW())
       WHERE midtrans_order_id=?`,
      [n.order_id]
    );
  } else {
    // jangan menurunkan pesanan yang sudah lunas
    await query(
      `UPDATE prescriptions SET payment_status=? WHERE midtrans_order_id=? AND payment_status<>'PAID'`,
      [status, n.order_id]
    );
  }
  return status;
}
