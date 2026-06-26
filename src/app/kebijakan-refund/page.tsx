import { LegalNav, LegalFooter } from "@/app/faq/page";

export const metadata = {
  title: "Kebijakan Refund — MoneyFlow",
  description: "Kebijakan pengembalian dana layanan MoneyFlow."
};

export default function KebijakanRefundPage() {
  return (
    <main className="min-h-dvh bg-background text-ink">
      <LegalNav />
      <div className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Kebijakan Refund</h1>
        <p className="mt-2 text-sm text-muted">Terakhir diperbarui: 26 Juni 2026</p>

        <div className="mt-6 rounded-2xl border-2 border-error bg-error-container/30 p-5">
          <p className="font-bold text-error">Kebijakan No-Refund</p>
          <p className="mt-1 text-sm leading-relaxed text-on-error-container">
            MoneyFlow menerapkan kebijakan <strong>tidak ada pengembalian dana (no-refund)</strong> dalam
            kondisi apapun setelah pembayaran berhasil diproses. Harap baca kebijakan ini dengan seksama
            sebelum melakukan pembayaran.
          </p>
        </div>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-ink">
          <Section title="1. Kebijakan Utama">
            <p>
              Semua pembayaran untuk langganan Premium MoneyFlow bersifat <strong>final dan tidak dapat dikembalikan</strong>.
              Kami tidak menerima permintaan refund setelah transaksi berhasil diproses, tanpa terkecuali,
              termasuk namun tidak terbatas pada: perubahan keputusan, ketidakpuasan terhadap layanan,
              atau tidak menggunakan layanan selama masa berlaku.
            </p>
          </Section>

          <Section title="2. Mengapa Tidak Ada Refund?">
            <p>
              Kami menyediakan <strong>trial Premium gratis selama 7 hari</strong> untuk setiap akun baru.
              Masa trial ini dirancang khusus agar kamu dapat mencoba semua fitur Premium secara penuh
              sebelum memutuskan untuk berlangganan. Dengan adanya trial gratis, kami menganggap pengguna
              telah memiliki kesempatan memadai untuk mengevaluasi layanan sebelum pembayaran dilakukan.
            </p>
            <p className="mt-2">
              Dengan melanjutkan ke pembayaran, kamu menyatakan telah memahami dan menyetujui kebijakan
              no-refund ini.
            </p>
          </Section>

          <Section title="3. Pengecualian Teknis">
            <p>
              Satu-satunya pengecualian yang dapat kami pertimbangkan adalah kegagalan teknis yang sepenuhnya
              berasal dari sistem kami, yaitu:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
              <li>
                <strong className="text-ink">Tagihan duplikat</strong> — pengguna dikenakan tagihan lebih dari
                satu kali untuk transaksi yang sama dalam satu sesi pembayaran.
              </li>
              <li>
                <strong className="text-ink">Pembayaran berhasil namun akun tidak teraktivasi</strong> — akun
                tidak berpindah ke status Premium dalam 24 jam setelah pembayaran terkonfirmasi dari gateway.
              </li>
            </ul>
            <p className="mt-3">
              Pengecualian ini harus dilaporkan dalam <strong>3 hari kerja</strong> sejak tanggal transaksi
              disertai bukti pembayaran yang valid.
            </p>
          </Section>

          <Section title="4. Cara Melaporkan Masalah Teknis">
            <p>Jika kamu mengalami salah satu kondisi pengecualian di atas, hubungi kami dengan menyertakan:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
              <li>Nama lengkap dan email akun MoneyFlow.</li>
              <li>Tanggal dan nominal transaksi.</li>
              <li>Screenshot atau nomor referensi pembayaran dari gateway.</li>
              <li>Penjelasan singkat masalah yang dialami.</li>
            </ul>
            <div className="mt-4 rounded-xl border border-outline bg-surface p-4">
              <p className="font-semibold text-ink">Laporkan ke:</p>
              <ul className="mt-2 list-none space-y-1 text-muted">
                <li>
                  Email:{" "}
                  <a href="mailto:contact@whypratama.com" className="font-semibold text-primary hover:underline">
                    contact@whypratama.com
                  </a>
                </li>
                <li>
                  WhatsApp:{" "}
                  <a href="https://wa.me/6282285718485" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                    082285718485
                  </a>
                </li>
              </ul>
            </div>
          </Section>

          <Section title="5. Perubahan Kebijakan">
            <p>
              Kami berhak mengubah Kebijakan Refund ini sewaktu-waktu. Perubahan material akan diumumkan
              melalui notifikasi dalam aplikasi paling lambat 7 hari sebelum berlaku. Penggunaan layanan
              setelah perubahan dianggap sebagai penerimaan kebijakan baru.
            </p>
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
