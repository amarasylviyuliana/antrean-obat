import './globals.css';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';

export const metadata = {
  title: 'AntreObat - Layanan Obat Tanpa Antre',
  description: 'Ambil obat nanti atau diantar ke rumah, tanpa menunggu di apotek klinik.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold text-teal-700">
              <span aria-hidden>💊</span> AntreObat
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
        <footer className="py-6 text-center text-xs text-slate-400">
          AntreObat · layanan mandiri obat, terpisah dari sistem pendaftaran klinik
        </footer>
      </body>
    </html>
  );
}
