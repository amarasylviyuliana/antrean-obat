'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import SnapScript, { payOrder, syncPayment } from '@/components/Snap';
import { StatusBadge, PayBadge } from '@/components/Badges';
import { flowFor, STATUS_LABEL } from '@/lib/constants';
import { formatDateTime, parseDateTime } from '@/lib/format';
import { deliveryEta, estimatedDeliveryMinutes, rupiah } from '@/lib/geo';
import { CLINIC_WHATSAPP, CLINIC_WHATSAPP_DISPLAY } from '@/lib/contact';

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
      <div className="surface-card p-6 text-center">
        <p className="text-red-600">{error}</p>
        <Link href="/lacak" className="btn-ghost mt-4">Coba kode lain</Link>
      </div>
    );
  if (!order) return <p className="text-center text-slate-500">Memuat...</p>;

  const flow = flowFor(order.method);
  const cancelled = order.status === 'DIBATALKAN';
  const whatsappUrl = `https://wa.me/${CLINIC_WHATSAPP}?text=${encodeURIComponent(`Halo, saya ingin menanyakan pesanan ${order.orderCode}.`)}`;
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
      <section className="surface-card p-5 sm:p-6">
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
          {order.method === 'DELIVERY' && (
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
            {(!cancelled || order.paymentStatus === 'PAID') && (
              <div className="mt-2"><PayBadge status={order.paymentStatus} /></div>
            )}
          </div>
        )}
      </section>

      {order.method === 'PICKUP' && !cancelled && (
        <section className="rounded-2xl bg-teal-50 p-4 text-sm text-teal-900">
          {order.status === 'SIAP_DIAMBIL'
            ? 'Obat sudah siap diambil di apotek klinik.'
            : order.status === 'SELESAI'
              ? 'Pesanan ini sudah selesai.'
              : 'Silakan tunggu email bahwa obat sudah siap sebelum datang ke klinik.'}
        </section>
      )}

      {cancelled && (
        <section className={`rounded-2xl border p-5 ${order.paymentStatus === 'PAID' ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
          <h2 className={`font-semibold ${order.paymentStatus === 'PAID' ? 'text-amber-900' : 'text-red-800'}`}>
            {order.paymentStatus === 'PAID' ? 'Pesanan dibatalkan, pembayaran sudah diterima' : 'Pesanan dibatalkan — tidak perlu membayar'}
          </h2>
          <p className={`mt-1 text-sm ${order.paymentStatus === 'PAID' ? 'text-amber-800' : 'text-red-700'}`}>
            {order.paymentStatus === 'PAID'
              ? 'Hubungi apotek melalui WhatsApp untuk informasi pengembalian dana.'
              : 'Jangan lanjutkan pembayaran. Jika Anda sudah membayar atau perlu informasi, hubungi apotek melalui WhatsApp.'}
            {' '}Sebutkan kode pesanan <b>{order.orderCode}</b>.
          </p>
          <p className={`mt-3 text-sm ${order.paymentStatus === 'PAID' ? 'text-amber-900' : 'text-red-800'}`}>
            <b>Alasan pembatalan:</b> {order.cancellationReason || 'Alasan belum dicatat. Silakan hubungi apotek untuk informasi lebih lanjut.'}
          </p>
          <a
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
          >
            Hubungi WhatsApp {CLINIC_WHATSAPP_DISPLAY}
          </a>
        </section>
      )}

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
        <section className="surface-card space-y-3 p-5 sm:p-6">
          <h2 className="section-title">Peta dan estimasi pengantaran</h2>
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

      <section className="surface-card p-5 sm:p-6">
        <h2 className="section-title mb-4">Progres pesanan</h2>
        {cancelled ? (
          <p className="text-red-600">Pesanan ini dibatalkan. Lihat alasan pembatalan dan hubungi apotek melalui WhatsApp di atas jika perlu bantuan.</p>
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
