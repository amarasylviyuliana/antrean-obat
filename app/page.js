import OrderForm from '@/components/OrderForm';
import OrderRecovery from '@/components/OrderRecovery';

export default function Home() {
  return (
    <div className="space-y-7">
      <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-700 px-6 py-8 text-white shadow-xl shadow-teal-950/10 sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-10 -top-20 -z-10 size-72 rounded-full border-[34px] border-white/[0.06]" aria-hidden />
        <div className="pointer-events-none absolute -bottom-28 right-28 -z-10 size-56 rounded-full bg-emerald-300/10 blur-2xl" aria-hidden />
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-teal-50">
            <span aria-hidden>✦</span> LEBIH NYAMAN, TANPA MENUNGGU
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Obat tanpa antre</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-teal-50 sm:text-base sm:leading-7">
            Sudah periksa di klinik? Masukkan nomor antrean dari kertas resep Anda, lalu pilih cara menerima obat yang paling nyaman.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-white/95">
            <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">✓ Pesan dengan mudah</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">✓ Ambil atau diantar</span>
          </div>
        </div>
      </section>
      <OrderRecovery />
      <OrderForm />
    </div>
  );
}
