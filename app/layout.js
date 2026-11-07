import './globals.css';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'AntreObat - Layanan Obat Tanpa Antre',
  description: 'Ambil obat nanti atau diantar ke rumah, tanpa menunggu di apotek klinik.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="min-h-screen">
        <header className="border-b border-white/70 bg-white/85 shadow-sm shadow-slate-900/[0.03] backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5 sm:px-6">
            <Link href="/" className="group flex items-center">
              <Image
                src="/antreobat-logo.png"
                alt="AntreObat - Antre Lebih Mudah, Obat Lebih Cepat"
                width={480}
                height={200}
                priority
                className="h-[68px] w-[200px] object-cover object-center sm:h-[76px] sm:w-[230px]"
              />
            </Link>
            <span className="hidden items-center gap-2 rounded-full border border-teal-100 bg-teal-50/80 px-3 py-1.5 text-xs font-semibold text-teal-800 sm:flex">
              <span className="size-2 rounded-full bg-teal-500" aria-hidden />
              Praktis dan mudah
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-7 sm:px-6 sm:py-9">{children}</main>
        <footer className="mx-auto mt-8 max-w-4xl border-t border-slate-200/80 px-4 py-6 text-center text-xs leading-relaxed text-slate-500 sm:px-6">
          <span className="font-semibold text-slate-600">AntreObat</span> · layanan mandiri obat, terpisah dari sistem pendaftaran klinik
        </footer>
      </body>
    </html>
  );
}
