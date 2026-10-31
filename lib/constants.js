// Label status & alur kerja (aman dipakai di server dan browser)

export const STATUS_LABEL = {
  MENUNGGU_VERIFIKASI: 'Menunggu Verifikasi',
  DIPROSES_DIRACIK: 'Diproses / Diracik',
  SIAP_DIAMBIL: 'Siap Diambil',
  DISERAHKAN_KURIR: 'Diserahkan ke Kurir',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
};

export const PAY_LABEL = {
  NONE: 'Tanpa pembayaran',
  PENDING: 'Menunggu pembayaran',
  PAID: 'Lunas',
  FAILED: 'Pembayaran gagal',
  EXPIRED: 'Pembayaran kedaluwarsa',
};

export function flowFor(method) {
  return method === 'DELIVERY'
    ? ['MENUNGGU_VERIFIKASI', 'DIPROSES_DIRACIK', 'DISERAHKAN_KURIR', 'SELESAI']
    : ['MENUNGGU_VERIFIKASI', 'DIPROSES_DIRACIK', 'SIAP_DIAMBIL', 'SELESAI'];
}

export function nextStatus(order) {
  if (order.status === 'DIBATALKAN' || order.status === 'SELESAI') return null;
  const flow = flowFor(order.method);
  const i = flow.indexOf(order.status);
  return flow[i + 1] || null;
}

export const STATUS_COLOR = {
  MENUNGGU_VERIFIKASI: 'bg-amber-100 text-amber-800',
  DIPROSES_DIRACIK: 'bg-blue-100 text-blue-800',
  SIAP_DIAMBIL: 'bg-emerald-100 text-emerald-800',
  DISERAHKAN_KURIR: 'bg-indigo-100 text-indigo-800',
  SELESAI: 'bg-slate-200 text-slate-700',
  DIBATALKAN: 'bg-red-100 text-red-700',
};

export const PAY_COLOR = {
  NONE: 'bg-slate-100 text-slate-600',
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-red-100 text-red-700',
};
