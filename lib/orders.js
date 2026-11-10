import crypto from 'crypto';
import { query } from './db';

export function generateOrderCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) s += chars[bytes[i] % chars.length];
  return `AO-${s}`;
}

export async function findByCode(code) {
  const rows = await query('SELECT * FROM prescriptions WHERE order_code = ? LIMIT 1', [code]);
  return rows[0] || null;
}

// Data yang aman ditampilkan ke pasien (tanpa token & id internal)
export function publicOrder(o) {
  return {
    orderCode: o.order_code,
    queueNumber: o.queue_number,
    patientName: o.patient_name,
    method: o.method,
    city: o.kota,
    kecamatan: o.kecamatan,
    kelurahan: o.kelurahan,
    addressDetail: o.address_detail,
    lat: o.lat,
    lng: o.lng,
    distanceKm: o.distance_km,
    shippingFee: o.shipping_fee,
    paymentStatus: o.payment_status,
    paymentExpiresAt: o.payment_expires_at,
    status: o.status,
    cancellationReason: o.cancellation_reason,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}
