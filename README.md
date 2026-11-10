# AntreObat

Layanan obat mandiri (ambil nanti / diantar) untuk klinik. Next.js 14 + Tailwind + MySQL + Leaflet + Midtrans Snap.

## Cara menjalankan (VS Code + XAMPP)

1. Nyalakan **Apache** dan **MySQL** di XAMPP.
2. Buka phpMyAdmin (http://localhost/phpmyadmin), tab **Import**, pilih `database.sql`, klik Go.
   (Opsional: aplikasi juga membuat database dan tabel otomatis saat pertama kali jalan.)
3. Di terminal VS Code:
   ```bash
   npm install
   npm run dev
   ```
4. Buka http://localhost:3000

## Halaman

| URL | Fungsi |
|---|---|
| `/` | Form pasien: nomor antrean/RM, pilih Ambil Nanti atau Diantar |
| `/lacak` dan `/lacak/KODE` | Lacak status, bayar ongkir bila belum lunas |
| `/petugas` | Dashboard farmasi (login default: `admin` / `admin123`, ganti segera); daftar pesanan dipaginasi 10 pesanan per halaman, dapat dicari berdasarkan kode, antrean/RM, nama pasien, atau nomor HP |
| `/kurir` | Daftar tugas antar: kurir dapat mengklaim tugas dan melihat pesanan yang diklaim dari browser yang sama |

## Alur status

- Ambil sendiri: `MENUNGGU_VERIFIKASI` > `DIPROSES_DIRACIK` > `SIAP_DIAMBIL` > `SELESAI`
- Diantar: `MENUNGGU_VERIFIKASI` > `DIPROSES_DIRACIK` > `DISERAHKAN_KURIR` > `SELESAI`
- Untuk ambil sendiri, pasien menerima email saat obat berstatus `SIAP_DIAMBIL`; pasien diminta datang setelah menerima pemberitahuan tersebut.
- Pesanan antar hanya bisa diproses setelah ongkir lunas. Pesanan yang belum diserahkan ke kurir dapat dibatalkan petugas; pesanan yang sudah dalam pengantaran tidak dapat dibatalkan dari dashboard.
- Saat pesanan dibatalkan, tautan pembayaran dinonaktifkan dan batas bayar tidak lagi ditampilkan. Pasien diarahkan menghubungi apotek melalui WhatsApp; bila pembayaran sudah diterima, halaman lacak meminta pasien menghubungi apotek untuk informasi pengembalian dana.
- Petugas wajib mengisi alasan saat membatalkan pesanan. Alasan tampil di halaman lacak dan email pasien. Pasien dapat menghubungi apotek melalui WhatsApp `0895 4002 000203`.
- Tugas kurir baru tersedia setelah petugas menyerahkan pesanan dan ongkir lunas. Di `/kurir`, kurir dapat mengklaim tugas sebanyak yang diperlukan tanpa batas jumlah; satu pesanan hanya dapat diklaim oleh satu browser. Tautan rute gabungan tersedia untuk pesanan yang sudah diklaim. Klaim dikenali melalui cookie browser, bukan akun/nama kurir, jadi perangkat yang berbeda diperlukan agar tugas setiap kurir tetap terpisah. Link `/kurir` tidak meminta login.
- Setelah estimasi pengantaran tercapai, kurir menyelesaikan pesanan dari halaman `/kurir`; pesanan yang dikonfirmasi selesai oleh pasien juga otomatis berpindah ke bagian Selesai di halaman kurir. Riwayat Selesai hanya menampilkan pesanan 24 jam terakhir, sementara semua data pesanan tetap tersimpan di database. Tombol penyelesaian pesanan antar tidak ditampilkan di dashboard petugas.
- Dashboard petugas menampilkan pesanan Selesai 24 jam terakhir pada daftar dan hitungan tab. Pesanan yang lebih lama tetap tersimpan di database dan dapat ditemukan dengan pencarian kode, antrean/RM, nama pasien, atau nomor HP.
- Pembayaran pesanan antar berlaku 30 menit sejak pesanan dibuat. Setelah scheduler localhost dipasang, sistem mengirim pengingat email 15 menit sebelum tenggat dan membatalkan pesanan otomatis setelah Midtrans memastikan pembayaran kedaluwarsa. Email wajib untuk pesanan antar.
- Email yang diisi diperiksa formatnya dan domainnya melalui DNS (record MX, atau alamat domain sebagai fallback). Gmail tidak diwajibkan; pemeriksaan domain tidak memastikan kotak masuk tertentu benar-benar ada atau dimiliki pasien.
- Jika lupa kode pesanan, pasien dapat mencari pesanan hari ini di halaman awal menggunakan nomor antrean/RM dan email saat memesan; tautan pelacakan dikirim ke email yang cocok.
- Nomor antrean mengikuti pola `A-` + 1–3 angka; nomor RM mengikuti pola `RM-` + 1–10 angka. Ini memeriksa format, bukan mencocokkan nomor dengan sistem klinik.
- Pilihan alamat mencakup Kota Bandung dan kecamatan Kabupaten Bandung sekitar klinik yang tercatat di formulir. Pin hanya dapat dipilih di dalam batas kelurahan yang dipilih; batasnya juga divalidasi ulang di server. Titik antar tetap dibatasi maksimal 20 km dari klinik.
- Data batas wilayah Bandung berasal dari [cahyadsn/wilayah_boundaries](https://github.com/cahyadsn/wilayah_boundaries), berdasarkan Kepmendagri No. 300.2.2-2430 Tahun 2025, dan berlisensi MIT. Salinan lisensi ada di [lib/area-boundaries.LICENSE](./lib/area-boundaries.LICENSE).

## Ongkir

Haversine dari klinik Buahbatu (-6.9483, 107.6432): 0-3 km Rp 8.000, lalu +Rp 2.500/km, dibulatkan ke atas per Rp 100. Di atas 20 km ditolak (dicek ulang di server).

## Midtrans

- Token: `POST /api/payment/token`
- Webhook: `POST /api/payment/notification` (signature diverifikasi)
- Sinkron manual: `POST /api/payment/sync` (dipanggil otomatis saat halaman lacak dibuka)

Di localhost webhook Midtrans tidak bisa menjangkau komputer Anda, jadi status lunas diperbarui lewat sinkron manual tadi. Untuk uji webhook: jalankan tunnel (mis. `ngrok http 3000`), lalu isi **Payment Notification URL** di dashboard Midtrans Sandbox dengan `https://<tunnel>/api/payment/notification`.

## Pengingat dan pembatalan pembayaran otomatis (localhost)

1. Pastikan SMTP untuk email sudah dikonfigurasi di `.env.local`.
2. Buat secret lokal dengan `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, lalu tambahkan hasilnya ke `.env.local` sebagai `CRON_SECRET=<secret>`. Jangan bagikan atau commit secret ini.
3. Restart `npm run dev` agar variabel lingkungan terbaca.
4. Dari PowerShell di folder proyek, pasang tugas Windows yang memeriksa pembayaran tiap menit:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\register-payment-maintenance.ps1
   ```
   Tugas berjalan saat akun Windows Anda login dan aplikasi Next.js aktif di `localhost:3000`.
5. Pengingat dikirim sekitar 15 menit sebelum tenggat. Setelah 30 menit, sistem memeriksa status transaksi Midtrans; pesanan dibatalkan dan email pembatalan dikirim setelah Midtrans memastikan transaksi belum dibayar/kedaluwarsa.

Endpoint terautentikasi untuk scheduler: `POST /api/cron/payments`. Saat aplikasi dipindahkan ke Vercel, jadwalkan endpoint yang sama menggunakan Vercel Cron dan simpan `CRON_SECRET` di Environment Variables Vercel.

## Catatan keamanan

- `.env.local` sudah masuk `.gitignore`. Jangan di-commit.
- Ganti `SESSION_SECRET` dengan teks acak panjang dan ganti password admin default.
- Karena App Password Gmail sempat dibagikan di chat, sebaiknya buat ulang di akun Google Anda.
