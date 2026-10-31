import OrderForm from '@/components/OrderForm';

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 p-6 text-white">
        <h1 className="text-2xl font-bold">Obat tanpa antre</h1>
        <p className="mt-1 text-sm text-teal-50">
          Sudah periksa di klinik? Masukkan nomor antrean dari kertas resep Anda, lalu pilih:
          ambil nanti atau diantar ke rumah.
        </p>
      </section>
      <OrderForm />
    </div>
  );
}
