'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LacakIndex() {
  const router = useRouter();
  const [code, setCode] = useState('');

  return (
    <form
      className="mx-auto max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) router.push(`/lacak/${code.trim().toUpperCase()}`);
      }}
    >
      <h1 className="text-xl font-bold">Lacak Pesanan Obat</h1>
      <p className="text-sm text-slate-500">Masukkan kode pesanan Anda (contoh: AO-7K3M9P).</p>
      <input className="input uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="AO-XXXXXX" />
      <button className="btn-primary w-full">Cari</button>
    </form>
  );
}
