'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/format';
import { deliveryEta, rupiah } from '@/lib/geo';

function TaskCard({ order, busyCode, onRelease, onComplete, canComplete, statusLabel }) {
  const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${order.lat},${order.lng}`)}`;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.03] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">#{order.order_code}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Antrean {order.queue_number}</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">✓ Dibayar online</span>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">{statusLabel}</span>
      </div>

      <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Pasien / penerima</p>
          <p className="mt-1 truncate font-bold text-slate-900">{order.patient_name}</p>
          <a className="mt-1 inline-flex text-sm text-teal-700 hover:underline" href={`tel:${order.phone}`}>☎ {order.phone}</a>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Alamat pengantaran</p>
          <p className="mt-1 text-sm text-slate-700">
            {order.address_detail}
            <br />
            {order.kelurahan ? `Kel. ${order.kelurahan}, ` : ''}
            Kec. {order.kecamatan}, {order.kota || 'Kota Bandung'}
          </p>
        </div>
        <div className="rounded-xl bg-teal-50 px-4 py-3 text-left sm:min-w-32 sm:text-right">
          <p className="text-xs text-slate-600">Jarak: {order.distance_km} km</p>
          <p className="font-extrabold text-teal-900">{rupiah(order.shipping_fee)}</p>
          <p className="text-[11px] font-medium text-teal-700">Ongkir kurir</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500">Dibuat {formatDateTime(order.created_at)}</p>
        <div className="flex flex-wrap gap-2">
        <a
          className="btn-ghost"
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
        >
          Lihat lokasi
        </a>
        {onClaim && (
          <button
            className="btn-primary"
            disabled={busyCode === order.order_code}
            onClick={() => onClaim(order.order_code)}
          >
            {busyCode === order.order_code ? 'Memproses...' : '🛵 Klaim tugas ini'}
          </button>
        )}
        {onRelease && (
          <button
            className="btn-ghost"
            disabled={busyCode === order.order_code}
            onClick={() => onRelease(order.order_code)}
          >
            Lepas tugas
          </button>
        )}
        {onComplete && (
          <button
            className="btn-primary"
            disabled={busyCode === order.order_code || !canComplete}
            onClick={() => onComplete(order.order_code)}
          >
            {busyCode === order.order_code ? 'Memproses...' : 'Selesaikan pengiriman'}
          </button>
        )}
        </div>
      </div>
      {onComplete && !canComplete && (
        <p className="text-xs text-slate-500">Tombol selesai aktif setelah estimasi waktu pengantaran tercapai.</p>
      )}
    </article>
  );
}

export default function Kurir() {
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState([]);
  const [err, setErr] = useState('');
  const [busyCode, setBusyCode] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const activeTasks = mine.filter((order) => order.status === 'DISERAHKAN_KURIR');
  const completedTasks = mine.filter((order) => order.status === 'SELESAI');
  const tabOrders = tab === 'active' ? activeTasks : tab === 'available' ? available : completedTasks;
  const normalizedSearch = search.trim().toLocaleLowerCase('id-ID');
  const filteredOrders = tabOrders.filter((order) =>
    [
      order.order_code,
      order.queue_number,
      order.patient_name,
      order.phone,
      order.kota,
      order.kecamatan,
      order.kelurahan,
      order.address_detail,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('id-ID')
      .includes(normalizedSearch)
  );
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/kurir/orders', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar tugas.');
      setAvailable(data.available);
      setMine(data.mine);
      setErr('');
    } catch (e) {
      setErr(e.message || 'Gagal memuat daftar tugas.');
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function updateClaim(orderCode, method) {
    setBusyCode(orderCode);
    setErr('');
    try {
      const res = await fetch('/api/kurir/orders', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui tugas.');
      await load();
    } catch (e) {
      setErr(e.message || 'Gagal memperbarui tugas.');
      await load();
    } finally {
      setBusyCode('');
    }
  }

  async function completeOrder(orderCode) {
    setBusyCode(orderCode);
    setErr('');
    try {
      const res = await fetch(`/api/kurir/orders/${encodeURIComponent(orderCode)}/complete`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyelesaikan pengiriman.');
      await load();
    } catch (e) {
      setErr(e.message || 'Gagal menyelesaikan pengiriman.');
      await load();
    } finally {
      setBusyCode('');
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface-card relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -right-7 -top-10 size-32 rounded-full bg-teal-50" aria-hidden />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Panel pengantaran rumah</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Tugas Kurir</h1>
          <p className="mt-1 text-sm text-slate-500">Daftar ini hanya menampilkan pesanan antar ke rumah. Tugas diperbarui otomatis.</p>
        </div>
      </div>

      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      <section className="surface-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'active', label: 'Sedang dikerjakan', count: activeTasks.length },
            { id: 'available', label: 'Tugas tersedia', count: available.length },
            { id: 'completed', label: 'Selesai · 24 jam', count: completedTasks.length },
          ].map((item) => (
            <button
              key={item.id}
              aria-pressed={tab === item.id}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === item.id ? 'bg-teal-800 text-white shadow-md shadow-teal-900/10' : 'border border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50'}`}
              onClick={() => {
                setTab(item.id);
                setSearch('');
                setPage(1);
              }}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>

        {tab === 'active' && activeTasks.length >= 2 && (
          <a
            className="btn-primary inline-flex"
            href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('-6.9483,107.6432')}&destination=${encodeURIComponent(`${activeTasks[activeTasks.length - 1].lat},${activeTasks[activeTasks.length - 1].lng}`)}&waypoints=${encodeURIComponent(`optimize:true|${activeTasks.slice(0, -1).map((order) => `${order.lat},${order.lng}`).join('|')}`)}&travelmode=driving`}
            target="_blank"
            rel="noreferrer"
          >
            Buka rute gabungan
          </a>
        )}

        <input
          className="input"
          type="search"
          placeholder="Cari kode, nama, antrean, telepon, atau alamat..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        {visibleOrders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-500">
            {normalizedSearch ? 'Pesanan tidak ditemukan.' : tab === 'active' ? 'Belum ada pesanan yang Anda klaim.' : tab === 'available' ? 'Tidak ada tugas yang menunggu kurir.' : 'Belum ada pesanan selesai.'}
          </p>
        ) : (
          <div className="space-y-3">
            {visibleOrders.map((order) => {
              if (tab === 'active') {
                const eta = deliveryEta(order.updated_at || order.courier_claimed_at, order.distance_km);
                return (
                  <TaskCard
                    key={order.order_code}
                    order={order}
                    busyCode={busyCode}
                    onRelease={(code) => updateClaim(code, 'DELETE')}
                    onComplete={completeOrder}
                    canComplete={eta !== null && now >= eta}
                    statusLabel="Sedang diantar"
                  />
                );
              }
              if (tab === 'completed') return <TaskCard key={order.order_code} order={order} statusLabel="Selesai diantar" />;
              return (
                <TaskCard
                  key={order.order_code}
                  order={order}
                  busyCode={busyCode}
                  onClaim={(code) => updateClaim(code, 'POST')}
                  statusLabel="Siap diantar"
                />
              );
            })}
          </div>
        )}

        {filteredOrders.length > pageSize && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm shadow-slate-900/[0.03]">
            <span className="text-slate-600">
              Halaman {currentPage} dari {pageCount} · {filteredOrders.length} pesanan
            </span>
            <div className="flex gap-2">
              <button
                className="btn-ghost"
                disabled={currentPage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Sebelumnya
              </button>
              <button
                className="btn-ghost"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
