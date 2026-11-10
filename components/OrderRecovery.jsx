'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSavedOrders } from '@/lib/saved-orders';

export default function OrderRecovery() {
  const [open, setOpen] = useState(false);
  const [savedOrders, setSavedOrders] = useState([]);
  const [queueNumber, setQueueNumber] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const refreshSavedOrders = () => setSavedOrders(getSavedOrders());
    refreshSavedOrders();
    const expiryTimer = setInterval(refreshSavedOrders, 60 * 1000);
    window.addEventListener('storage', refreshSavedOrders);
    window.addEventListener('antreobat:saved-orders', refreshSavedOrders);
    return () => {
      clearInterval(expiryTimer);
      window.removeEventListener('storage', refreshSavedOrders);
      window.removeEventListener('antreobat:saved-orders', refreshSavedOrders);
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSent(false);
    try {
      const response = await fetch('/api/orders/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueNumber, email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mencari pesanan.');
      setSent(true);
    } catch (requestError) {
      setError(requestError.message || 'Gagal mencari pesanan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-card mx-auto w-full max-w-4xl space-y-5 p-5 sm:p-6">
      {savedOrders.length > 0 && (
        <div>
          <h2 className="font-bold text-slate-900">Pesanan tersimpan di perangkat ini</h2>
          <p className="mt-1 text-sm text-slate-500">Bisa dibuka kembali dari browser ini dan terhapus otomatis setelah 24 jam.</p>
          <ul className="mt-3 divide-y divide-slate-100">
            {savedOrders.map((order) => (
              <li key={order.orderCode} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-semibold text-slate-800">{order.queueNumber || 'Pesanan'} · {order.orderCode}</p>
                  {order.createdAt && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {new Date(order.createdAt.replace(' ', 'T')).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link className="btn-ghost px-3 py-1.5 text-sm" href={`/lacak/${order.orderCode}`}>Lihat status</Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">Sudah pernah membuat pesanan?</h2>
          <p className="mt-1 text-sm text-slate-500">Cari pesanan hari ini jika lupa kode pelacakan.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => setOpen((value) => !value)}>
          {open ? 'Tutup' : 'Cari pesanan'}
        </button>
      </div>

      {open && (
        <form className="mt-4 space-y-3 border-t border-slate-100 pt-4" onSubmit={submit}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nomor antrean / RM *</span>
            <input
              className="input"
              required
              value={queueNumber}
              onChange={(event) => setQueueNumber(event.target.value.toUpperCase())}
              placeholder="Contoh: A-023 atau RM-12345"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Email yang digunakan saat memesan *</span>
            <input
              className="input"
              type="email"
              required
              maxLength={150}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@email.com"
              autoComplete="email"
            />
          </label>
          <p className="text-xs text-slate-500">
            Jika cocok dengan pesanan hari ini, tautan pelacakan akan dikirim ke email tersebut.
          </p>
          <button className="btn-primary w-full sm:w-auto" disabled={busy}>
            {busy ? 'Mencari pesanan...' : 'Kirim tautan pelacakan'}
          </button>
          {sent && (
            <p role="status" className="text-sm text-teal-800">
              Jika pesanan cocok, tautan pelacakan akan dikirim. Periksa kotak masuk dan folder spam email Anda.
            </p>
          )}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </form>
      )}
    </section>
  );
}
