import Link from "next/link";
import { LegalNav, LegalFooter } from "@/app/faq/page";

export const metadata = {
  title: "Syarat & Ketentuan — MoneyFlow",
  description: "Syarat dan ketentuan penggunaan layanan MoneyFlow."
};

export default function SyaratKetentuanPage() {
  return (
    <main className="min-h-dvh bg-background text-ink">
      <LegalNav />
      <div className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Syarat &amp; Ketentuan</h1>
        <p className="mt-2 text-sm text-muted">Terakhir diperbarui: 26 Juni 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-ink">
          <Section title="1. Penerimaan Syarat">
            <p>
              Dengan mengakses atau menggunakan aplikasi MoneyFlow (&ldquo;Layanan&rdquo;), kamu menyetujui untuk
              terikat oleh Syarat dan Ketentuan ini. Jika kamu tidak menyetujui syarat ini, harap tidak menggunakan
              Layanan kami.
            </p>
          </Section>

          <Section title="2. Deskripsi Layanan">
            <p>
              MoneyFlow adalah aplikasi pencatatan keuangan pribadi berbasis web (PWA) yang memungkinkan pengguna
              mencatat pemasukan, pengeluaran, hutang, piutang, dan membuat laporan keuangan pribadi. Layanan ini
              dioperasikan oleh Wahyu Pratama, berdomisili di Indonesia.
            </p>
          </Section>

          <Section title="3. Akun Pengguna">
            <ul className="list-disc space-y-1.5 pl-5 text-muted">
              <li>Kamu wajib mendaftar dengan informasi yang akurat dan lengkap.</li>
              <li>Kamu bertanggung jawab penuh atas kerahasiaan kata sandi akunmu.</li>
              <li>Kamu wajib segera memberitahu kami jika terjadi penggunaan akun yang tidak sah.</li>
              <li>Satu orang hanya boleh mendaftarkan satu akun untuk penggunaan pribadi.</li>
            </ul>
          </Section>

          <Section title="4. Penggunaan yang Diizinkan">
            <p>Kamu boleh menggunakan Layanan untuk:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
              <li>Mencatat dan mengelola keuangan pribadi atau keluarga.</li>
              <li>Membuat laporan dan mengekspor data keuangan milikmu sendiri.</li>
              <li>Berbagi akses dompet dengan anggota keluarga atau pasangan atas persetujuan bersama.</li>
            </ul>
          </Section>

          <Section title="5. Penggunaan yang Dilarang">
            <p>Kamu dilarang:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
              <li>Menggunakan Layanan untuk aktivitas ilegal atau penipuan.</li>
              <li>Mencoba meretas, merusak, atau mengganggu sistem kami.</li>
              <li>Menjual, menyewakan, atau mengalihkan akses akunmu kepada pihak lain.</li>
              <li>Menggunakan bot, scraper, atau otomatisasi untuk mengakses Layanan tanpa izin.</li>
            </ul>
          </Section>

          <Section title="6. Data dan Privasi">
            <p>
              Penggunaan data pribadimu diatur oleh Kebijakan Privasi kami. Dengan menggunakan Layanan,
              kamu menyetujui pengumpulan dan penggunaan data sebagaimana dijelaskan dalam kebijakan tersebut.
              Kami tidak menjual data pribadimu kepada pihak ketiga.
            </p>
          </Section>

          <Section title="7. Ketersediaan Layanan">
            <p>
              Kami berupaya menjaga Layanan tetap aktif 24/7, namun tidak menjamin ketersediaan tanpa gangguan.
              Kami berhak melakukan pemeliharaan, pembaruan, atau menghentikan Layanan sewaktu-waktu dengan atau
              tanpa pemberitahuan sebelumnya.
            </p>
          </Section>

          <Section title="8. Batasan Tanggung Jawab">
            <p>
              MoneyFlow adalah alat bantu pencatatan keuangan. Kami tidak bertanggung jawab atas keputusan
              keuangan yang kamu buat berdasarkan data dalam aplikasi. Dalam batas yang diizinkan hukum,
              kami tidak bertanggung jawab atas kerugian tidak langsung atau konsekuensial yang timbul dari
              penggunaan Layanan.
            </p>
          </Section>

          <Section title="9. Perubahan Syarat">
            <p>
              Kami dapat mengubah Syarat dan Ketentuan ini sewaktu-waktu. Perubahan signifikan akan diberitahukan
              melalui email atau notifikasi dalam aplikasi. Penggunaan Layanan yang berkelanjutan setelah
              perubahan dianggap sebagai penerimaan syarat yang baru.
            </p>
          </Section>

          <Section title="10. Hukum yang Berlaku">
            <p>
              Syarat dan Ketentuan ini diatur oleh hukum Republik Indonesia. Segala sengketa yang timbul akan
              diselesaikan melalui musyawarah terlebih dahulu, dan jika tidak tercapai kesepakatan, melalui
              pengadilan yang berwenang di Indonesia.
            </p>
          </Section>

          <Section title="11. Hubungi Kami">
            <p>
              Pertanyaan mengenai Syarat &amp; Ketentuan dapat disampaikan melalui:
            </p>
            <ul className="mt-2 list-none space-y-1 text-muted">
              <li>Email: <a href="mailto:contact@whypratama.com" className="font-semibold text-primary hover:underline">contact@whypratama.com</a></li>
              <li>Telepon / WhatsApp: <a href="tel:082285718485" className="font-semibold text-primary hover:underline">082285718485</a></li>
            </ul>
          </Section>
        </div>
      </div>
      <LegalFooter />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <div className="mt-2 text-muted">{children}</div>
    </section>
  );
}
