'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LacakIndex() {
  const router = useRouter();
  const [code, setCode] = useState('');

  return (
    <form
      className="surface-card mx-auto max-w-md space-y-4 p-6 sm:p-7"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) router.push(`/lacak/${code.trim().toUpperCase()}`);
      }}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-teal-50 text-2xl" aria-hidden>🔎</span>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Lacak Pesanan Obat</h1>
        <p className="mt-1 text-sm text-slate-500">Pantau perkembangan pesanan Anda.</p>
      </div>
      <p className="text-sm text-slate-500">Masukkan kode pesanan Anda (contoh: AO-7K3M9P).</p>
      <input className="input uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="AO-XXXXXX" />
      <button className="btn-primary w-full">Cari</button>
    </form>
  );
}
