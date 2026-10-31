'use client';

import Script from 'next/script';

const SRC =
  process.env.NEXT_PUBLIC_MIDTRANS_ENV === 'production'
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

export default function SnapScript() {
  return (
    <Script
      src={SRC}
      data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
      strategy="afterInteractive"
    />
  );
}

// Buka popup pembayaran Midtrans Snap untuk pesanan tertentu.
// Mengembalikan 'success' | 'pending' | 'error' | 'closed'.
export async function payOrder(orderCode) {
  const res = await fetch('/api/payment/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderCode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gagal membuat pembayaran.');
  if (!window.snap) throw new Error('Skrip pembayaran Midtrans belum termuat. Coba lagi sesaat lagi.');

  return new Promise((resolve) => {
    window.snap.pay(data.token, {
      onSuccess: () => resolve('success'),
      onPending: () => resolve('pending'),
      onError: () => resolve('error'),
      onClose: () => resolve('closed'),
    });
  });
}

export async function syncPayment(orderCode) {
  try {
    await fetch('/api/payment/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderCode }),
    });
  } catch {}
}
