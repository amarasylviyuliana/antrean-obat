'use client';

import { useCallback, useEffect, useState } from 'react';
import { StatusBadge, PayBadge } from '@/components/Badges';
import { STATUS_LABEL, nextStatus } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { rupiah } from '@/lib/geo';

const TABS = ['SEMUA', 'MENUNGGU_VERIFIKASI', 'DIPROSES_DIRACIK', 'SIAP_DIAMBIL', 'DISERAHKAN_KURIR', 'SELESAI', 'DIBATALKAN'];

export default function Petugas() {
  const [user, setUser] = useState(undefined); // undefined = memuat, null = belum login
  const [login, setLogin] = useState({ username: '', password: '' });
  const [loginErr, setLoginErr] = useState('');
  const [tab, setTab] = useState('SEMUA');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [err, setErr] = useState('');
  const [busyCode, setBusyCode] = useState('');
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
  }, [page, tab]);

  useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
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

  async function setStatus(code, status) {
    setBusyCode(code);
    setErr('');
    try {
      const res = await fetch(`/api/admin/orders/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      setErr(e.message || 'Gagal mengubah status.');
    } finally {
      setBusyCode('');
    }
  }

  if (user === undefined) return <p className="text-center text-slate-500">Memuat...</p>;

  if (!user)
    return (
      <form onSubmit={doLogin} className="mx-auto max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">Login Petugas Farmasi</h1>
        <input className="input" placeholder="Username" value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} />
        <input className="input" type="password" placeholder="Password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
        {loginErr && <p className="text-sm text-red-600">{loginErr}</p>}
        <button className="btn-primary w-full">Masuk</button>
      </form>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard Farmasi</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">{user.name || user.username}</span>
          <button className="btn-ghost" onClick={logout}>Keluar</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setPage(1);
              setTab(t);
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === t ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 hover:bg-teal-50'}`}
          >
            {t === 'SEMUA' ? 'Semua' : STATUS_LABEL[t]}
            {t !== 'SEMUA' && counts[t] ? ` (${counts[t]})` : ''}
          </button>
        ))}
      </div>

      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {orders.length === 0 && !err && <p className="py-10 text-center text-slate-500">Belum ada pesanan.</p>}

      <div className="space-y-3">
        {orders.map((o) => {
          const next = nextStatus(o);
          const canCancel =
            o.status !== 'SELESAI' &&
            o.status !== 'DIBATALKAN' &&
            !(o.method === 'DELIVERY' && o.status === 'DISERAHKAN_KURIR');
          const showNext = next && !(o.method === 'DELIVERY' && o.status === 'DISERAHKAN_KURIR');
          return (
            <article key={o.order_code} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-teal-700">{o.order_code}</span>
                  <span className="text-xs text-slate-500">Antrean {o.queue_number}</span>
                </div>
                <div className="flex gap-2">
                  <StatusBadge status={o.status} />
                  {o.method === 'DELIVERY' && <PayBadge status={o.payment_status} />}
                </div>
              </div>
              <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                <p className="text-slate-600">Dibuat: {formatDateTime(o.created_at)}</p>
                {o.method === 'DELIVERY' && o.payment_status !== 'PAID' && o.payment_expires_at && (
                  <p className="text-amber-800">Batas bayar: {formatDateTime(o.payment_expires_at)}</p>
                )}
                <p><b>{o.patient_name}</b> · {o.phone}</p>
                <p>{o.method === 'DELIVERY' ? '🛵 Antar' : '🚶 Ambil sendiri'}</p>
                {o.method === 'PICKUP' ? (
                  <p>Jam ambil: <b>{String(o.pickup_time).slice(0, 16)}</b></p>
                ) : (
                  <p>
                    {o.kelurahan ? `Desa/Kel. ${o.kelurahan}, ` : ''}Kec. {o.kecamatan}, {o.kota || 'Kota Bandung'} · {o.distance_km} km · {rupiah(o.shipping_fee)}
                  </p>
                )}
              </div>
              {o.method === 'DELIVERY' && (
                <p className="mt-1 text-sm text-slate-600">
                  {o.address_detail}{' '}
                  <a className="text-teal-700 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${o.lat},${o.lng}`}>
                    Buka peta
                  </a>
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {showNext && (
                  <button
                    className="btn-primary"
                    disabled={busyCode === o.order_code}
                    onClick={() => setStatus(o.order_code, next)}
                  >
                    {STATUS_LABEL[next]}
                  </button>
                )}
                {canCancel && (
                  <button
                    className="btn-ghost text-red-600"
                    disabled={busyCode === o.order_code}
                    onClick={() => confirm(`Batalkan pesanan ${o.order_code}?`) && setStatus(o.order_code, 'DIBATALKAN')}
                  >
                    Batalkan
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm">
          <span className="text-slate-600">
            Halaman {page} dari {pageCount} · {total} pesanan
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
