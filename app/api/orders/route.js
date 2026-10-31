import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { AREAS_BY_CITY, calcShipping, OUT_OF_RANGE_MSG } from '@/lib/geo';
import { generateOrderCode, findByCode, publicOrder } from '@/lib/orders';
import { PAYMENT_WINDOW_MINUTES } from '@/lib/payments';
import { sendOrderEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const clean = (v, max) => String(v ?? '').trim().slice(0, max);

export async function POST(req) {
  try {
    const b = await req.json();
    const queueNumber = clean(b.queueNumber, 40);
    const patientName = clean(b.patientName, 120);
    const phone = clean(b.phone, 25);
    const email = clean(b.email, 150);
    const method = b.method;

    if (!/^(A-\d{1,3}|RM-\d{1,10})$/.test(queueNumber)) {
      return err('Masukkan nomor antrean (A- dan 1–3 angka) atau nomor RM (RM- dan 1–10 angka) sesuai kertas resep.');
    }
    if (!patientName) return err('Nama pasien wajib diisi.');
    if (!/^[0-9+\-\s]{8,20}$/.test(phone)) return err('Nomor HP tidak valid.');
    if (method === 'DELIVERY' && !email) return err('Email wajib diisi untuk pengingat dan pemberitahuan pembayaran.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Format email tidak valid.');
    if (method !== 'PICKUP' && method !== 'DELIVERY') return err('Pilih metode layanan obat.');

    let pickupTime = null;
    let kota = null;
    let kecamatan = null;
    let kelurahan = null;
    let addressDetail = null;
    let lat = null;
    let lng = null;
    let distanceKm = null;
    let fee = 0;

    if (method === 'PICKUP') {
      const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(String(b.pickupTime || ''));
      if (!m) return err('Tentukan jam pengambilan obat.');
      const when = new Date(`${m[1]}T${m[2]}:00+07:00`);
      if (isNaN(when) || when.getTime() < Date.now() - 5 * 60 * 1000)
        return err('Jam pengambilan harus di waktu yang akan datang.');
      pickupTime = `${m[1]} ${m[2]}:00`;
    } else {
      lat = Number(b.lat);
      lng = Number(b.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return err('Pilih lokasi pengantaran di peta.');
      kota = clean(b.kota, 80);
      const areas = AREAS_BY_CITY[kota];
      if (!areas) return err('Pilih kota/kabupaten tujuan.');
      kecamatan = clean(b.kecamatan, 80);
      kelurahan = clean(b.kelurahan, 80) || null;
      addressDetail = clean(b.addressDetail, 255);
      const area = areas.find((entry) => entry.kecamatan === kecamatan);
      if (!area) return err('Pilih kecamatan sesuai kota/kabupaten.');
      if (!kelurahan || !area.kelurahan.includes(kelurahan)) return err('Pilih kelurahan yang sesuai dengan kecamatan.');
      if (!addressDetail) return err('Alamat lengkap (jalan, nomor rumah) wajib diisi.');
      const ship = calcShipping(lat, lng); // dihitung ulang di server
      if (!ship.within) return err(OUT_OF_RANGE_MSG);
      distanceKm = ship.distanceKm;
      fee = ship.fee;
    }

    let code = generateOrderCode();
    for (let i = 0; i < 5 && (await findByCode(code)); i++) code = generateOrderCode();

    await query(
      `INSERT INTO prescriptions
        (order_code, queue_number, patient_name, phone, email, method, kota, pickup_time,
         kecamatan, kelurahan, address_detail, lat, lng, distance_km, shipping_fee, payment_status, payment_expires_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
         CASE WHEN ? = 'DELIVERY' THEN DATE_ADD(NOW(), INTERVAL ${PAYMENT_WINDOW_MINUTES} MINUTE) ELSE NULL END)`,
      [
        code, queueNumber, patientName, phone, email || null, method, kota, pickupTime,
        kecamatan, kelurahan, addressDetail, lat, lng, distanceKm, fee,
        method === 'DELIVERY' ? 'PENDING' : 'NONE', method,
      ]
    );

    const order = await findByCode(code);
    sendOrderEmail(
      order,
      `Pesanan obat ${code} diterima`,
      method === 'DELIVERY'
        ? `Permintaan pengantaran obat Anda sudah kami terima. Selesaikan pembayaran ongkir dalam ${PAYMENT_WINDOW_MINUTES} menit, paling lambat ${formatDateTime(order.payment_expires_at)}, agar pesanan diproses.`
        : 'Permintaan pengambilan obat Anda sudah kami terima. Apoteker akan memverifikasi resep dan meracik obat.'
    );

    return NextResponse.json({ ok: true, order: publicOrder(order) });
  } catch (e) {
    console.error('[POST /api/orders]', e);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server. Pastikan MySQL (XAMPP) sudah menyala.' },
      { status: 500 }
    );
  }
}

function err(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}
