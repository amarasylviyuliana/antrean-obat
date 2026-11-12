'use client';

import { useCallback, useEffect, useState } from 'react';
import { StatusBadge, PayBadge } from '@/components/Badges';
import { STATUS_LABEL, nextStatus } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { rupiah } from '@/lib/geo';

const TABS = ['SEMUA', 'MENUNGGU_VERIFIKASI', 'DIPROSES_DIRACIK', 'SIAP_DIAMBIL', 'DISERAHKAN_KURIR', 'SELESAI', 'DIBATALKAN'];
const STATUS_ACCENT = {
  MENUNGGU_VERIFIKASI: 'border-l-amber-400',
  DIPROSES_DIRACIK: 'border-l-sky-500',
  SIAP_DIAMBIL: 'border-l-emerald-500',
  DISERAHKAN_KURIR: 'border-l-teal-600',
  SELESAI: 'border-l-slate-300',
  DIBATALKAN: 'border-l-red-400',
};

export default function Petugas() {
  const [user, setUser] = useState(undefined); // undefined = memuat, null = belum login
  const [login, setLogin] = useState({ username: '', password: '' });
  const [loginErr, setLoginErr] = useState('');
  const [tab, setTab] = useState('SEMUA');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [busyCode, setBusyCode] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const totalCount = Object.entries(counts).reduce(
    (sum, [status, count]) => sum + (status === 'DIBATALKAN' ? 0 : count),
    0
  );
  const readyCount = (counts.SIAP_DIAMBIL || 0) + (counts.DISERAHKAN_KURIR || 0);
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setUser(d.user || null))
      .catch(() => setUser(null));
  }, []);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (tab !== 'SEMUA') params.set('status', tab);
      if (search) params.set('q', search);
      const res = await fetch(`/api/admin/orders?${params}`, { cache: 'no-store' });
      if (res.status === 401) return setUser(null);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders(data.orders);
      setCounts(Object.fromEntries(data.counts.map((c) => [c.status, Number(c.c)])));
      setPage(data.pagination.page);
      setPageCount(data.pagination.pageCount);
      setTotal(data.pagination.total);
      setErr('');
    } catch (e) {
      setErr(e.message || 'Gagal memuat data.');
    }
  }, [page, search, tab]);

  useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [user, load]);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    let checking = false;
    const checkExpiredPayments = async () => {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch('/api/admin/orders/expire', { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal memeriksa batas pembayaran.');
        if (active && data.autoCancelled > 0) await load();
      } catch (error) {
        if (active) setErr(error.message || 'Gagal memeriksa batas pembayaran.');
      } finally {
        checking = false;
      }
    };

    checkExpiredPayments();
    const timer = setInterval(checkExpiredPayments, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user, load]);

  async function doLogin(e) {
    e.preventDefault();
    setLoginErr('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(login),
    });
    const data = await res.json();
    if (!res.ok) return setLoginErr(data.error || 'Login gagal.');
    setUser(data.user);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setOrders([]);
  }

  async function setStatus(code, status, cancellationReason) {
    setBusyCode(code);
    setErr('');
    setNotice('');
    try {
      const res = await fetch(`/api/admin/orders/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, cancellationReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
      if (data.warning) setNotice(data.warning);
      return true;
    } catch (e) {
      setErr(e.message || 'Gagal mengubah status.');
      return false;
    } finally {
      setBusyCode('');
    }
  }

  if (user === undefined) return <p className="text-center text-slate-500">Memuat...</p>;

  if (!user)
    return (
      <form onSubmit={doLogin} className="surface-card mx-auto max-w-sm space-y-4 p-6 sm:p-7">
        <span className="grid size-12 place-items-center rounded-2xl bg-teal-50 text-2xl" aria-hidden>🧑‍⚕️</span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Login Petugas Farmasi</h1>
          <p className="mt-1 text-sm text-slate-500">Masuk untuk mengelola pesanan obat.</p>
        </div>
        <input className="input" placeholder="Username" value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} />
        <input className="input" type="password" placeholder="Password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
        {loginErr && <p className="text-sm text-red-600">{loginErr}</p>}
        <button className="btn-primary w-full">Masuk</button>
      </form>
    );

  return (
    <div className="space-y-4">
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Panel petugas farmasi</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Dashboard Farmasi AntreObat</h1>
          <p className="mt-1 text-sm text-slate-500">Kelola antrean dan pesanan obat dari satu tempat.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-teal-50 px-3 py-2 font-semibold text-teal-800">Petugas Farmasi</span>
          <button className="btn-ghost" onClick={logout}>Keluar</button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Total antrean', count: totalCount, note: 'Pesanan aktif dan terbaru', tone: 'text-slate-900', icon: '▤' },
          { label: 'Menunggu verifikasi', count: counts.MENUNGGU_VERIFIKASI || 0, note: 'Perlu diperiksa', tone: 'text-amber-700', icon: '◷' },
          { label: 'Sedang diproses', count: counts.DIPROSES_DIRACIK || 0, note: 'Dalam proses farmasi', tone: 'text-sky-700', icon: '⚗' },
          { label: 'Siap diambil / diantar', count: readyCount, note: 'Menunggu serah terima', tone: 'text-emerald-700', icon: '✓' },
          { label: 'Selesai · 24 jam', count: counts.SELESAI || 0, note: 'Tuntas diserahkan', tone: 'text-teal-800', icon: '◉' },
        ].map((item) => (
          <article key={item.label} className="surface-card min-w-0 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium leading-4 text-slate-500">{item.label}</p>
              <span className={`text-sm ${item.tone}`} aria-hidden>{item.icon}</span>
            </div>
            <p className={`mt-2 text-2xl font-extrabold tracking-tight ${item.tone}`}>{item.count}</p>
            <p className="mt-1 text-[11px] text-slate-400">{item.note}</p>
          </article>
        ))}
      </section>

      <section className="surface-card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-800">Filter status</h2>
          <span className="text-xs text-slate-500">Pembaruan otomatis setiap 5 detik</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setPage(1);
                setTab(t);
              }}
              aria-pressed={tab === t}
              className={`rounded-full px-3 py-2 text-xs font-semibold transition ${tab === t ? 'bg-teal-800 text-white shadow-md shadow-teal-900/10' : 'border border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50'}`}
            >
              {t === 'SEMUA' ? 'Semua' : t === 'DIPROSES_DIRACIK' ? 'Proses' : STATUS_LABEL[t]}
              {t !== 'SEMUA' && counts[t] ? ` (${counts[t]})` : ''}
            </button>
          ))}
        </div>
      </section>

      <form
        className="surface-card flex flex-col gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <label className="sr-only" htmlFor="order-search">Cari pesanan</label>
        <input
          id="order-search"
          className="input flex-1"
          type="search"
          maxLength={100}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Cari kode pesanan, antrean/RM, nama pasien, atau nomor HP"
        />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary">Cari pesanan</button>
          {search && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setPage(1);
              }}
            >
              Hapus pencarian
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Pesanan selesai lebih dari 24 jam tetap bisa ditemukan lewat pencarian.
        </p>
      </form>

      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {notice && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{notice}</div>}
      {cancelTarget && (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/50 p-4" role="presentation">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-order-title"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!cancelReason.trim()) return;
              if (await setStatus(cancelTarget.order_code, 'DIBATALKAN', cancelReason.trim())) {
                setCancelTarget(null);
                setCancelReason('');
              }
            }}
            className="surface-card w-full max-w-md space-y-4 p-5 sm:p-6"
          >
            <div>
              <h2 id="cancel-order-title" className="text-lg font-bold text-slate-900">Alasan pembatalan</h2>
              <p className="mt-1 text-sm text-slate-600">
                Alasan untuk pesanan <b>{cancelTarget.order_code}</b> akan ditampilkan kepada pasien.
              </p>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Alasan *</span>
              <textarea
                autoFocus
                required
                maxLength={255}
                className="input"
                rows={3}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Contoh: stok obat tidak tersedia"
              />
            </label>
            {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => { setCancelTarget(null); setCancelReason(''); setErr(''); }}>
                Kembali
              </button>
              <button type="submit" className="btn-primary" disabled={busyCode === cancelTarget.order_code || !cancelReason.trim()}>
                {busyCode === cancelTarget.order_code ? 'Membatalkan...' : 'Konfirmasi pembatalan'}
              </button>
            </div>
          </form>
        </div>
      )}
      {orders.length === 0 && !err && (
        <p className="surface-card py-10 text-center text-slate-500">
          {search ? 'Pesanan tidak ditemukan.' : 'Belum ada pesanan.'}
        </p>
      )}

      <div className="space-y-3">
        {orders.map((o) => {
          const next = nextStatus(o);
          const canCancel =
            o.status !== 'SELESAI' &&
            o.status !== 'DIBATALKAN' &&
            !(o.method === 'DELIVERY' && o.status === 'DISERAHKAN_KURIR');
          const showNext =
            next &&
            !(o.method === 'DELIVERY' && o.status === 'DISERAHKAN_KURIR') &&
            !(o.method === 'DELIVERY' && o.payment_status !== 'PAID');
          const nextLabel = o.method === 'DELIVERY' && next === 'DIPROSES_DIRACIK'
            ? 'Proses'
            : STATUS_LABEL[next];
          const statusLabel = o.method === 'DELIVERY' && o.status === 'DIPROSES_DIRACIK'
            ? 'Proses'
            : STATUS_LABEL[o.status];
          return (
            <article key={o.order_code} className={`rounded-2xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm shadow-slate-900/[0.03] sm:px-5 sm:py-4 ${STATUS_ACCENT[o.status] || 'border-l-slate-300'}`}>
              <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Antrean</span>
                  <span className="text-base font-extrabold text-teal-800">{o.queue_number}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">#{o.order_code}</span>
                  <StatusBadge status={o.status} label={statusLabel} />
                  {o.method === 'DELIVERY' && (o.status !== 'DIBATALKAN' || o.payment_status === 'PAID') && <PayBadge status={o.payment_status} />}
                  <span className="text-xs text-slate-500">{o.method === 'DELIVERY' ? '🛵 Diantar ke rumah' : '🚶 Diambil di klinik'}</span>
              </div>

              <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-[0.9fr_1.5fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Pasien</p>
                  <p className="mt-0.5 font-bold text-slate-900">{o.patient_name}</p>
                  <a className="mt-0.5 inline-flex text-xs text-teal-700 hover:underline" href={`tel:${o.phone}`}>☎ {o.phone}</a>
                </div>
                <div className="min-w-0 text-[13px]">
                  {o.method === 'PICKUP' ? (
                    <>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Pengambilan</p>
                      <p className="mt-0.5 text-slate-700">Pasien akan menerima email saat obat siap diambil.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Alamat pengantaran</p>
                      <p className="mt-0.5 text-slate-700">
                        {o.address_detail}
                        <br />
                        {o.kelurahan ? `Desa/Kel. ${o.kelurahan}, ` : ''}Kec. {o.kecamatan}, {o.kota || 'Kota Bandung'}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-xs text-slate-500">{o.distance_km} km · {rupiah(o.shipping_fee)}</span>
                        <a className="text-xs font-semibold text-teal-700 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${o.lat},${o.lng}`}>
                          Buka peta
                        </a>
                      </div>
                    </>
                  )}
                  {o.status === 'DIBATALKAN' && o.cancellation_reason && (
                    <p className="mt-2 text-red-700"><b>Alasan pembatalan:</b> {o.cancellation_reason}</p>
                  )}
                  {o.method === 'DELIVERY' && o.status !== 'DIBATALKAN' && o.payment_status !== 'PAID' && o.payment_expires_at && (
                    <p className="mt-2 text-xs text-amber-800">Batas bayar: {formatDateTime(o.payment_expires_at)}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:max-w-44 sm:flex-col sm:items-stretch">
                  {showNext && (
                    <button
                      className="btn-primary px-3 py-2 text-xs"
                      disabled={busyCode === o.order_code}
                      onClick={() => setStatus(o.order_code, next)}
                    >
                      {nextLabel}
                    </button>
                  )}
                  {canCancel && (
                    <button
                      className="btn-ghost px-3 py-2 text-xs text-red-600"
                      disabled={busyCode === o.order_code}
                      onClick={() => { setCancelTarget(o); setCancelReason(''); setErr(''); }}
                    >
                      Batalkan
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Dibuat {formatDateTime(o.created_at)}</p>
            </article>
          );
        })}
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm">
          <span className="text-slate-600">
            Halaman {page} dari {pageCount} · {total} pesanan{search ? ' ditemukan' : ''}
          </span>
          <div className="flex gap-2">
            <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Sebelumnya
            </button>
            <button className="btn-ghost" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
              Berikutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
