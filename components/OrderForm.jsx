'use client';

import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import AreaSearch from './AreaSearch';
import SnapScript, { payOrder, syncPayment } from './Snap';
import { CLINIC, calcShipping, isPointInPolygon, rupiah, OUT_OF_RANGE_MSG, BASE_FEE, BASE_KM, PER_KM, MAX_KM } from '@/lib/geo';

const MapPicker = dynamic(() => import('./MapPicker'), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl bg-slate-200" />,
});

function pad(n) {
  return String(n).padStart(2, '0');
}
function toLocalInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function plusMinutes(min) {
  return toLocalInput(new Date(Date.now() + min * 60000));
}

export default function OrderForm() {
  const router = useRouter();
  const [form, setForm] = useState({ numberType: 'ANTREAN', numberDigits: '', patientName: '', phone: '', email: '' });
  const [method, setMethod] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState(null); // { kecamatan, kelurahan, lat, lng }
  const [pin, setPin] = useState(null); // { lat, lng }
  const [boundary, setBoundary] = useState(null);
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [boundaryError, setBoundaryError] = useState('');
  const boundaryRequestRef = useRef(0);
  const [flyKey, setFlyKey] = useState(0);
  const [addressDetail, setAddressDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emailCheck, setEmailCheck] = useState({ value: '', status: 'idle', message: '' });
  const emailCheckRequestRef = useRef(0);

  const quote = useMemo(() => (pin ? calcShipping(pin.lat, pin.lng) : null), [pin]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function checkEmail(value) {
    const email = value.trim().toLowerCase();
    const requestId = ++emailCheckRequestRef.current;
    if (!email) {
      setEmailCheck({ value: '', status: 'idle', message: '' });
      return true;
    }

    setEmailCheck({ value: email, status: 'checking', message: 'Memeriksa format dan domain email...' });
    try {
      const response = await fetch('/api/validate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (requestId !== emailCheckRequestRef.current) return false;
      if (!response.ok) throw new Error(data.error || 'Email tidak valid.');
      setEmailCheck({ value: email, status: 'valid', message: 'Format benar dan domain email ditemukan.' });
      return true;
    } catch (validationError) {
      if (requestId !== emailCheckRequestRef.current) return false;
      setEmailCheck({ value: email, status: 'invalid', message: validationError.message });
      return false;
    }
  }

  function chooseNumberType(numberType) {
    setForm((current) => ({ ...current, numberType, numberDigits: '' }));
  }

  function setNumberDigits(value) {
    const maxLength = form.numberType === 'ANTREAN' ? 3 : 10;
    setForm((current) => ({
      ...current,
      numberDigits: value.replace(/\D/g, '').slice(0, maxLength),
    }));
  }

  async function chooseArea(e) {
    setArea({ kecamatan: e.kecamatan, kelurahan: e.kelurahan, lat: e.lat, lng: e.lng });
    setBoundary(null);
    setBoundaryError('');
    const requestId = ++boundaryRequestRef.current;
    if (!e.kelurahan) {
      setBoundaryLoading(false);
      setPin({ lat: e.lat, lng: e.lng });
      setFlyKey((k) => k + 1);
      return;
    }

    setBoundaryLoading(true);
    setPin(null);
    try {
      const params = new URLSearchParams({ city, kecamatan: e.kecamatan, kelurahan: e.kelurahan });
      const response = await fetch(`/api/area-boundaries?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat batas wilayah.');
      if (requestId !== boundaryRequestRef.current) return;
      setBoundary(data.boundary);
      setPin({ lat: data.boundary.lat, lng: data.boundary.lng });
      setFlyKey((k) => k + 1);
    } catch (e) {
      if (requestId !== boundaryRequestRef.current) return;
      console.error('[OrderForm] Gagal memuat batas kelurahan:', e);
      setBoundaryError(e.message || 'Gagal memuat batas wilayah.');
    } finally {
      if (requestId === boundaryRequestRef.current) setBoundaryLoading(false);
    }
  }

  function chooseCity(value) {
    boundaryRequestRef.current += 1;
    setCity(value);
    setArea(null);
    setPin(null);
    setBoundary(null);
    setBoundaryLoading(false);
    setBoundaryError('');
  }

  function onMapChange(lat, lng) {
    if (!boundary || !isPointInPolygon(lat, lng, boundary.path)) {
      setBoundaryError('Pin harus berada di dalam batas kelurahan yang dipilih.');
      return;
    }
    setPin({ lat, lng });
    setBoundaryError('');
  }

  function onInvalidMapPoint() {
    setBoundaryError('Pin harus berada di dalam batas kelurahan yang dipilih.');
  }

  async function submit(ev) {
    ev.preventDefault();
    setError('');
    if (!method) return setError('Pilih metode layanan obat terlebih dahulu.');
    if (form.email.trim() && !(await checkEmail(form.email))) {
      return setError('Periksa kembali alamat email sebelum melanjutkan.');
    }
    if (
      method === 'DELIVERY' &&
      (!area?.kelurahan || !boundary || !pin || !isPointInPolygon(pin.lat, pin.lng, boundary.path))
    ) {
      return setError('Pilih titik pengantaran di dalam kelurahan yang dipilih.');
    }
    if (method === 'DELIVERY' && quote && !quote.within) return setError(OUT_OF_RANGE_MSG);

    setBusy(true);
    try {
      const body = {
        ...form,
        queueNumber: `${form.numberType === 'RM' ? 'RM' : 'A'}-${form.numberDigits}`,
        method,
        pickupTime: method === 'PICKUP' ? pickupTime : undefined,
        kota: city,
        kecamatan: area?.kecamatan,
        kelurahan: area?.kelurahan,
        addressDetail,
        lat: pin?.lat,
        lng: pin?.lng,
      };
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat pesanan.');

      const code = data.order.orderCode;
      if (method === 'DELIVERY') {
        try {
          const result = await payOrder(code);
          if (result === 'success' || result === 'pending') await syncPayment(code);
        } catch (e) {
          // pesanan sudah tersimpan; pasien bisa membayar dari halaman lacak
          console.error(e);
        }
      }
      router.push(`/lacak/${code}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <SnapScript />

      <section className="surface-card p-5 sm:p-6">
        <h2 className="section-title mb-1 flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-teal-50 text-xs font-extrabold text-teal-800">1</span>
          Data dari klinik
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Isi sesuai nomor antrean / RM pada kertas resep dari klinik.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset className="sm:col-span-2">
            <legend className="mb-1 block text-sm font-medium">Nomor dari kertas resep *</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">Jenis nomor</span>
                <select className="input" value={form.numberType} onChange={(e) => chooseNumberType(e.target.value)}>
                  <option value="ANTREAN">Nomor Antrean (contoh A-023)</option>
                  <option value="RM">Nomor Rekam Medis (contoh RM-004521)</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">
                  Angka {form.numberType === 'RM' ? 'No. RM' : 'Antrean'}
                </span>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 font-medium text-slate-600">
                    {form.numberType === 'RM' ? 'RM-' : 'A-'}
                  </span>
                  <input
                    className="input rounded-l-none"
                    required
                    type="text"
                    inputMode="numeric"
                    pattern={form.numberType === 'RM' ? '[0-9]{1,10}' : '[0-9]{1,3}'}
                    maxLength={form.numberType === 'RM' ? 10 : 3}
                    value={form.numberDigits}
                    onChange={(e) => setNumberDigits(e.target.value)}
                    placeholder={form.numberType === 'RM' ? '004521' : '023'}
                  />
                </div>
                <span className="mt-1 block text-xs text-slate-500">
                  Masukkan angka yang tercetak pada kertas resep; huruf dan teks lain tidak diterima.
                </span>
              </label>
            </div>
          </fieldset>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nama Pasien *</span>
            <input className="input" required value={form.patientName} onChange={set('patientName')} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">No. HP / WhatsApp *</span>
            <input className="input" required inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="08xxxxxxxxxx" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Email {method === 'DELIVERY' ? '(wajib untuk notifikasi pembayaran)' : '(opsional, untuk notifikasi)'}
            </span>
            <input
              className={`input ${emailCheck.status === 'invalid' ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`}
              type="email"
              maxLength={150}
              required={method === 'DELIVERY'}
              aria-invalid={emailCheck.status === 'invalid'}
              aria-describedby="email-validation"
              value={form.email}
              onChange={(event) => {
                emailCheckRequestRef.current += 1;
                setForm((current) => ({ ...current, email: event.target.value }));
                setEmailCheck({ value: '', status: 'idle', message: '' });
              }}
              onBlur={(event) => checkEmail(event.target.value)}
            />
            {emailCheck.message && (
              <span
                id="email-validation"
                role={emailCheck.status === 'invalid' ? 'alert' : 'status'}
                className={`mt-1 block text-xs ${emailCheck.status === 'invalid' ? 'text-red-600' : emailCheck.status === 'valid' ? 'text-teal-700' : 'text-slate-500'}`}
              >
                {emailCheck.message}
              </span>
            )}
          </label>
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <h2 className="section-title mb-3 flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-teal-50 text-xs font-extrabold text-teal-800">2</span>
          Pilih layanan obat
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMethod('PICKUP')}
            aria-pressed={method === 'PICKUP'}
            className={`rounded-2xl border-2 p-4 text-left transition duration-200 hover:-translate-y-0.5 ${method === 'PICKUP' ? 'border-teal-600 bg-teal-50 shadow-md shadow-teal-900/5' : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/40'}`}
          >
            <div className="mb-3 grid size-11 place-items-center rounded-xl bg-teal-100 text-2xl">🚶</div>
            <div className="font-bold text-slate-900">Diambil Lagi Nanti</div>
            <div className="text-sm text-slate-500">Tentukan jam ambil sendiri di klinik. Gratis.</div>
          </button>
          <button
            type="button"
            onClick={() => setMethod('DELIVERY')}
            aria-pressed={method === 'DELIVERY'}
            className={`rounded-2xl border-2 p-4 text-left transition duration-200 hover:-translate-y-0.5 ${method === 'DELIVERY' ? 'border-teal-600 bg-teal-50 shadow-md shadow-teal-900/5' : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/40'}`}
          >
            <div className="mb-3 grid size-11 place-items-center rounded-xl bg-emerald-100 text-2xl">🛵</div>
            <div className="font-bold text-slate-900">Diantar ke Rumah</div>
            <div className="text-sm text-slate-500">Kurir antar dari {CLINIC.kecamatan}. Ongkir dibayar online.</div>
          </button>
        </div>
      </section>

      {method === 'PICKUP' && (
        <section className="surface-card p-5 sm:p-6">
          <h2 className="section-title mb-3 flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-teal-50 text-xs font-extrabold text-teal-800">3</span>
            Kapan Anda mengambil obat?
          </h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              ['1 jam lagi', 60],
              ['2 jam lagi', 120],
              ['3 jam lagi', 180],
            ].map(([label, m]) => (
              <button key={label} type="button" className="btn-ghost" onClick={() => setPickupTime(plusMinutes(m))}>
                {label}
              </button>
            ))}
          </div>
          <input
            className="input"
            type="datetime-local"
            required
            min={plusMinutes(0)}
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)}
          />
          <p className="mt-2 text-xs text-slate-500">Waktu setempat (WIB). Obat disiapkan sebelum jam tersebut.</p>
        </section>
      )}

      {method === 'DELIVERY' && (
        <section className="surface-card space-y-4 p-5 sm:p-6">
          <h2 className="section-title flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-teal-50 text-xs font-extrabold text-teal-800">3</span>
            Alamat pengantaran
          </h2>
          <AreaSearch city={city} onCityChange={chooseCity} selected={area} onSelect={chooseArea} />
          <div>
            <p className="mb-2 text-sm text-slate-500">
              Pilih kelurahan, lalu klik peta atau geser pin 📍 di dalam garis batas wilayah. 🏥 = {CLINIC.name}. Lingkaran = batas {MAX_KM} km.
            </p>
            <MapPicker value={pin} boundary={boundary} onChange={onMapChange} onInvalid={onInvalidMapPoint} flyKey={flyKey} />
            {boundaryLoading && <p className="mt-2 text-sm text-slate-500">Memuat batas kelurahan...</p>}
            {boundaryError && <p role="alert" className="mt-2 text-sm text-red-700">{boundaryError}</p>}
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Alamat lengkap (jalan, nomor, patokan) *</span>
            <textarea className="input" rows={2} required value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} />
          </label>

          {quote && (
            <div className={`rounded-xl p-4 text-sm ${quote.within ? 'bg-teal-50 text-teal-900' : 'bg-red-50 text-red-700'}`}>
              {quote.within ? (
                <>
                  <div>Jarak dari klinik: <b>{quote.distanceKm.toFixed(2)} km</b></div>
                  <div className="text-lg font-bold">Ongkir {rupiah(quote.fee)}</div>
                  <div className="text-xs opacity-70">
                    {rupiah(BASE_FEE)} untuk 0-{BASE_KM} km, lalu {rupiah(PER_KM)}/km berikutnya.
                  </div>
                </>
              ) : (
                <b>{OUT_OF_RANGE_MSG}</b>
              )}
            </div>
          )}
        </section>
      )}

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {method && (
        <button
          className="btn-primary w-full py-3 text-base"
          disabled={busy || (method === 'DELIVERY' && (!city || !pin || !area?.kelurahan || !boundary || boundaryLoading || (quote && !quote.within)))}
        >
          {busy
            ? 'Memproses...'
            : method === 'DELIVERY'
            ? `Kirim & Bayar Ongkir${quote?.within ? ' ' + rupiah(quote.fee) : ''}`
            : 'Kirim Permintaan Obat'}
        </button>
      )}
    </form>
  );
}
