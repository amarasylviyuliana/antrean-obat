'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import SnapScript, { payOrder, syncPayment } from '@/components/Snap';
import { StatusBadge, PayBadge } from '@/components/Badges';
import { flowFor, STATUS_LABEL } from '@/lib/constants';
import { formatDateTime, parseDateTime } from '@/lib/format';
import { deliveryEta, estimatedDeliveryMinutes, rupiah } from '@/lib/geo';

const CourierMap = dynamic(() => import('@/components/CourierMap'), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl bg-slate-200" />,
});

export default function LacakDetail({ params }) {
  const code = decodeURIComponent(params.code).toUpperCase();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [paying, setPaying] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(
    async (sync) => {
      try {
        if (sync) await syncPayment(code);
        const res = await fetch(`/api/orders/${encodeURIComponent(code)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat pesanan.');
        setOrder(data.order);
        setError('');
      } catch (e) {
        setError(e.message);
      }
    },
    [code]
  );

  useEffect(() => {
    // sinkronkan status pembayaran saat halaman dibuka (webhook tidak sampai ke localhost)
    load(true);
    const t = setInterval(() => load(false), 10000);
    return () => clearInterval(t);
  }, [load]);

  async function pay() {
    setPaying(true);
    setMsg('');
    try {
      const r = await payOrder(code);
      await load(true);
      if (r === 'error') setMsg('Pembayaran gagal. Silakan coba lagi.');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setPaying(false);
    }
  }

  async function confirmDelivery() {
    setConfirming(true);
    setConfirmError('');
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(code)}/confirm`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengonfirmasi penerimaan pesanan.');
      setOrder(data.order);
    } catch (e) {
      setConfirmError(e.message || 'Gagal mengonfirmasi penerimaan pesanan.');
    } finally {
      setConfirming(false);
    }
  }

  if (error)
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="text-red-600">{error}</p>
        <Link href="/lacak" className="btn-ghost mt-4">Coba kode lain</Link>
      </div>
    );
  if (!order) return <p className="text-center text-slate-500">Memuat...</p>;

  const flow = flowFor(order.method);
  const cancelled = order.status === 'DIBATALKAN';
  const idx = flow.indexOf(order.status);
  const needPay = order.method === 'DELIVERY' && order.paymentStatus !== 'PAID' && !cancelled;
  const eta = order.method === 'DELIVERY' && order.status === 'DISERAHKAN_KURIR'
    ? deliveryEta(order.updatedAt, order.distanceKm)
    : null;
  const etaReached = eta !== null && now >= eta;
  const paymentExpiresAt = parseDateTime(order.paymentExpiresAt);
  const paymentDeadlineReached =
    order.method === 'DELIVERY' &&
    order.paymentStatus !== 'PAID' &&
    paymentExpiresAt !== null &&
    now >= paymentExpiresAt.getTime();

  return (
    <div className="space-y-4">
      <SnapScript />
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">Kode pesanan</p>
            <h1 className="text-2xl font-bold tracking-wide text-teal-700">{order.orderCode}</h1>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-slate-500">Pasien</dt><dd className="font-medium">{order.patientName}</dd></div>
          <div><dt className="text-slate-500">No. Antrean / RM</dt><dd className="font-medium">{order.queueNumber}</dd></div>
          <div><dt className="text-slate-500">Tanggal pesanan</dt><dd className="font-medium">{formatDateTime(order.createdAt)}</dd></div>
          <div>
            <dt className="text-slate-500">Metode</dt>
            <dd className="font-medium">{order.method === 'DELIVERY' ? '🛵 Diantar ke rumah' : '🚶 Diambil di klinik'}</dd>
          </div>
          {order.method === 'PICKUP' ? (
            <div><dt className="text-slate-500">Jam ambil</dt><dd className="font-medium">{String(order.pickupTime).slice(0, 16).replace('T', ' ')} WIB</dd></div>
          ) : (
            <div><dt className="text-slate-500">Ongkir</dt><dd className="font-medium">{rupiah(order.shippingFee)} ({order.distanceKm} km)</dd></div>
          )}
        </dl>
        {order.method === 'DELIVERY' && (
          <div className="mt-3 text-sm">
            <p className="text-slate-500">Alamat</p>
            <p className="font-medium">
              {order.addressDetail}
              <br />
              {order.kelurahan ? `Desa/Kel. ${order.kelurahan}, ` : ''}Kec. {order.kecamatan}, {order.city || 'Kota Bandung'}
            </p>
            <div className="mt-2"><PayBadge status={order.paymentStatus} /></div>
          </div>
        )}
      </section>

      {needPay && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">Ongkir {rupiah(order.shippingFee)} belum dibayar</p>
          <p className="text-sm text-amber-800">Pesanan antar diproses apoteker setelah pembayaran berhasil.</p>
          {paymentExpiresAt && (
            <p className="mt-2 text-sm text-amber-800">
              Batas pembayaran: {formatDateTime(order.paymentExpiresAt)}.
            </p>
          )}
          {paymentDeadlineReached ? (
            <p className="mt-3 text-sm font-medium text-amber-900">
              Batas pembayaran sudah lewat. Pesanan sedang menunggu proses pembatalan otomatis.
            </p>
          ) : (
            <button className="btn-primary mt-3" onClick={pay} disabled={paying}>
              {paying ? 'Membuka pembayaran...' : 'Bayar Sekarang'}
            </button>
          )}
          {msg && <p className="mt-2 text-sm text-red-700">{msg}</p>}
        </section>
      )}

      {order.method === 'DELIVERY' && order.status === 'DISERAHKAN_KURIR' && (
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Peta dan estimasi pengantaran</h2>
          <CourierMap
            destination={{ lat: Number(order.lat), lng: Number(order.lng) }}
            startedAt={order.updatedAt}
            durationMinutes={estimatedDeliveryMinutes(order.distanceKm)}
          />
          <p className="text-sm">
            Perkiraan waktu perjalanan: <b>sekitar {estimatedDeliveryMinutes(order.distanceKm)} menit</b>
            {' '}dari klinik ({order.distanceKm} km).
          </p>
          <p className="text-xs text-slate-500">
            Ikon kurir bergerak berdasarkan estimasi waktu dari jarak, bukan posisi GPS atau rute jalan sebenarnya.
            Waktu tiba hanya perkiraan dan dapat berbeda dari kondisi nyata.
          </p>
          <div className="border-t border-slate-100 pt-3">
            {etaReached ? (
              <>
                <p className="mb-2 text-sm font-medium text-teal-800">
                  Estimasi pengantaran sudah tercapai. Jika obat sudah diterima, konfirmasikan di bawah.
                </p>
                <button className="btn-primary" onClick={confirmDelivery} disabled={confirming}>
                  {confirming ? 'Menyimpan konfirmasi...' : 'Pesanan Sudah Diterima'}
                </button>
              </>
            ) : (
              <button className="btn-ghost" disabled>
                {eta === null
                  ? 'Estimasi pengantaran belum tersedia'
                  : `Konfirmasi penerimaan tersedia dalam ${Math.ceil((eta - now) / 60000)} menit`}
              </button>
            )}
            {confirmError && <p className="mt-2 text-sm text-red-600">{confirmError}</p>}
          </div>
        </section>
      )}

      {order.method === 'DELIVERY' && order.status === 'SELESAI' && (
        <section className="rounded-2xl bg-teal-50 p-5 text-sm text-teal-900">
          Anda telah mengonfirmasi bahwa pesanan sudah diterima. Terima kasih!
        </section>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Progres pesanan</h2>
        {cancelled ? (
          <p className="text-red-600">Pesanan ini dibatalkan. Hubungi apotek klinik untuk informasi lebih lanjut.</p>
        ) : (
          <ol className="space-y-3">
            {flow.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    i < idx ? 'bg-teal-600 text-white' : i === idx ? 'bg-teal-100 text-teal-800 ring-2 ring-teal-600' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {i < idx ? '✓' : i + 1}
                </span>
                <span className={i <= idx ? 'font-medium' : 'text-slate-400'}>{STATUS_LABEL[s]}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
