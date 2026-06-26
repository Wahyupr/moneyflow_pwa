import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";

export const metadata = {
  title: "FAQ — MoneyFlow",
  description: "Pertanyaan yang sering ditanyakan seputar MoneyFlow."
};

const FAQS = [
  {
    q: "Apa itu MoneyFlow?",
    a: "MoneyFlow adalah aplikasi pencatatan keuangan pribadi berbasis PWA (Progressive Web App) yang dirancang khusus untuk pengguna Indonesia. Kamu bisa mencatat transaksi lewat suara, scan struk, atau input manual."
  },
  {
    q: "Apakah MoneyFlow gratis?",
    a: "MoneyFlow memiliki dua paket: Free dan Premium. Paket Free bisa digunakan selamanya dengan fitur dasar. Setiap akun baru mendapatkan trial Premium gratis selama 7 hari untuk mencoba semua fitur tanpa batasan."
  },
  {
    q: "Apa perbedaan paket Free dan Premium?",
    a: "Paket Free mencakup: input manual, input suara (AI parsing maksimal 2x per hari), scan struk (1x per hari), maksimal 3 dompet, 1 budget aktif, dan laporan 3 bulan terakhir. Paket Premium (Rp29.000/bulan) mencakup semua fitur tanpa batasan: input suara AI unlimited, scan struk unlimited, dompet tak terbatas, budget unlimited, laporan lengkap semua waktu, fitur Hutang & Piutang, AI insight dashboard, dan akses chatbot saat tersedia."
  },
  {
    q: "Apa yang terjadi dengan dompet saya jika trial berakhir dan saya punya lebih dari 3 dompet?",
    a: "Dompet ke-4 dan seterusnya akan dikunci sementara — tidak bisa digunakan untuk transaksi baru. Data dompet tersebut tetap aman dan tersimpan. Upgrade ke Premium kapan saja untuk membukanya kembali."
  },
  {
    q: "Bagaimana cara upgrade ke Premium?",
    a: "Buka halaman Pengaturan > Upgrade Premium, atau kunjungi halaman /upgrade. Pembayaran dilakukan via iPaymu dan diproses secara aman. Setelah pembayaran berhasil, akun Premium aktif langsung."
  },
  {
    q: "Jika saya upgrade saat trial belum habis, apakah sisa trial terbuang?",
    a: "Tidak. Sisa hari trial akan diakumulasi dengan periode Premium baru. Misalnya jika kamu masih punya 2 hari trial dan upgrade, maka akses Premium kamu menjadi 32 hari (2 + 30 hari)."
  },
  {
    q: "Bagaimana sistem kuota AI Voice bekerja?",
    a: "Input suara yang hanya mendeteksi angka/kata sederhana (sistem) tidak terhitung kuota. Kuota berlaku untuk AI parsing — ketika AI memproses kalimat natural menjadi transaksi lengkap. Untuk pengguna Free, tersedia 2x AI parsing per hari. Saat kamu menggunakan AI untuk ke-2 kalinya dalam sehari, akan muncul konfirmasi bahwa ini adalah penggunaan terakhir. Jika kuota sudah habis dan kamu mencoba lagi, akan ada notifikasi untuk upgrade."
  },
  {
    q: "Apakah ada refund jika saya tidak puas?",
    a: "Tidak. MoneyFlow tidak menerima permintaan refund dalam kondisi apapun setelah pembayaran berhasil diproses. Kami menyediakan trial gratis 7 hari justru agar kamu bisa mencoba semua fitur Premium sebelum memutuskan berlangganan. Pastikan kamu memanfaatkan masa trial sepenuhnya sebelum upgrade."
  },
  {
    q: "Bagaimana cara mendaftar?",
    a: "Klik tombol 'Daftar Gratis' di halaman utama, masukkan nama, email, dan password. Kami akan mengirim email verifikasi ke alamat emailmu. Klik tautan verifikasi, dan akunmu siap digunakan dengan trial Premium 7 hari."
  },
  {
    q: "Apakah data saya aman?",
    a: "Keamanan data adalah prioritas kami. Semua data dienkripsi saat transit (HTTPS) dan saat disimpan. Kami tidak menjual atau membagikan data pribadimu kepada pihak ketiga."
  },
  {
    q: "Bagaimana fitur input suara bekerja?",
    a: "Ucapkan transaksimu secara natural, misalnya 'beli kopi 25 ribu di Kopi Kenangan'. AI kami akan mengurai kalimat tersebut dan mengisi nominal, merchant, kategori, dan dompet secara otomatis."
  },
  {
    q: "Bagaimana cara scan struk?",
    a: "Buka menu Scan Struk, foto struk belanja atau bukti transfer. AI akan membaca total, merchant, dan tanggal dari gambar. Kamu tinggal memeriksa dan menyimpan hasilnya."
  },
  {
    q: "Apakah bisa dipakai offline?",
    a: "Ya. MoneyFlow adalah PWA yang dapat dipasang di ponsel seperti aplikasi biasa. Fitur pencatatan dasar tetap berjalan saat offline, dan data akan tersinkronisasi otomatis begitu kamu kembali online."
  },
  {
    q: "Dompet apa saja yang didukung?",
    a: "MoneyFlow mendukung berbagai jenis dompet seperti Cash, GoPay, OVO, Dana, ShopeePay, BCA, Mandiri, BRI, BNI, dan banyak lagi. Kamu juga bisa menambahkan dompet kustom."
  },
  {
    q: "Bisakah saya berbagi dompet dengan orang lain?",
    a: "Ya, fitur Multi Dompet memungkinkan kamu mengundang anggota keluarga atau pasangan untuk berbagi dan mencatat dalam satu dompet yang sama."
  },
  {
    q: "Bagaimana cara ekspor laporan?",
    a: "Buka menu Laporan, pilih periode yang diinginkan, lalu klik tombol Ekspor Excel. File .xlsx akan terunduh ke perangkatmu."
  },
  {
    q: "Saya lupa password, apa yang harus dilakukan?",
    a: "Buka halaman Login, klik 'Lupa Password', masukkan emailmu, dan kami akan mengirimkan tautan untuk mengatur ulang password."
  },
  {
    q: "Bagaimana cara menghubungi tim support?",
    a: "Kamu bisa menghubungi kami melalui email contact@whypratama.com atau telepon/WhatsApp di 082285718485. Kami siap membantu pada hari kerja Senin–Jumat pukul 09.00–17.00 WIB."
  }
];

export default function FaqPage() {
  return (
    <main className="min-h-dvh bg-background text-ink">
      <LegalNav />
      <div className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Pertanyaan Umum (FAQ)</h1>
        <p className="mt-3 text-muted">Tidak menemukan jawaban yang kamu cari? Hubungi kami di{" "}
          <a href="mailto:contact@whypratama.com" className="font-semibold text-primary hover:underline">contact@whypratama.com</a>.
        </p>

        <div className="mt-10 space-y-4">
          {FAQS.map((item, i) => (
            <details key={i} className="group rounded-2xl border border-outline bg-surface p-5 shadow-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {item.q}
                <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
      <LegalFooter />
    </main>
  );
}

export function LegalNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-outline/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft size={16} />
          Kembali
        </Link>
        <span className="text-outline">|</span>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/brand-mark.svg" alt="MoneyFlow" className="size-7 rounded-lg" />
          <span className="font-bold">MoneyFlow</span>
        </div>
      </div>
    </nav>
  );
}

export function LegalFooter() {
  return (
    <footer className="border-t border-outline/60">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-muted">
          <Link href="/faq" className="hover:text-ink">FAQ</Link>
          <Link href="/syarat-ketentuan" className="hover:text-ink">Syarat & Ketentuan</Link>
          <Link href="/kebijakan-refund" className="hover:text-ink">Kebijakan Refund</Link>
          <Link href="/kontak" className="hover:text-ink">Kontak</Link>
        </div>
        <p className="mt-4 text-center text-xs text-muted">© {new Date().getFullYear()} MoneyFlow. Hak cipta dilindungi.</p>
      </div>
    </footer>
  );
}
