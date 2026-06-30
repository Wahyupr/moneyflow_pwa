import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  HandCoins,
  Landmark,
  Mic,
  PencilLine,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
  Wallet,
  WifiOff
} from "lucide-react";
// Note: Wallet is still used in FEATURES array for "Multi Dompet" feature card
import { Reveal } from "@/components/landing/reveal";
import { Pricing } from "@/components/landing/pricing";



export const metadata = {
  title: "MoneyFlow — Catat keuangan secepat bicara",
  description: "Aplikasi keuangan pribadi Indonesia: catat transaksi lewat suara, scan struk, dan kelola dompet dalam satu tempat."
};

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-background text-ink">
      <LandingNav />
      <Hero />
      <StatsBand />
      <Features />
      <HowItWorks />
      <Pricing />
      <CtaSection />
      <LandingFooter />

    </main>
  );
}

function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-outline/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/brand-mark.svg" alt="MoneyFlow" className="size-9 rounded-xl" />
          <span className="text-lg font-extrabold tracking-tight">MoneyFlow</span>
        </div>
        <div className="flex items-center gap-2">
          <Link className="hidden min-h-10 items-center rounded-lg px-4 text-sm font-semibold text-muted hover:text-ink sm:flex" href="#pricing">
            Harga
          </Link>
          <Link className="hidden min-h-10 items-center rounded-lg px-4 text-sm font-semibold text-muted hover:text-ink sm:flex" href="/login">
            Masuk
          </Link>
          <Link className="flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-bold text-white shadow-card transition active:scale-[0.98]" href="/register">
            Daftar Gratis
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft brand gradient blobs for a modern, non-flat backdrop. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="lp-blob absolute -left-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="lp-blob absolute -right-16 top-20 size-72 rounded-full bg-income/20 blur-3xl" style={{ animationDelay: "-6s" }} />
        <div className="lp-blob absolute bottom-0 left-1/3 size-64 rounded-full bg-secondary/15 blur-3xl" style={{ animationDelay: "-12s" }} />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
        <div className="lp-hero-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-outline bg-surface px-3 py-1 text-xs font-bold text-primary shadow-card">
            <Sparkles size={13} />
            Catat keuangan pakai AI
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Catat keuangan{" "}
            <span className="lp-gradient-text bg-gradient-to-r from-primary via-income to-secondary bg-clip-text text-transparent">secepat bicara.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
            Ucapkan transaksimu, foto struk, atau catat manual. MoneyFlow merapikan dompet, kategori, dan merchant secara otomatis — khusus untuk gaya keuangan orang Indonesia.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="group flex min-h-12 items-center gap-2 rounded-xl bg-primary px-6 font-bold text-white shadow-lift transition hover:shadow-[0_16px_50px_rgba(22,104,220,0.4)] active:scale-[0.98]" href="/register">
              Mulai Gratis
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link className="flex min-h-12 items-center rounded-xl border border-outline bg-surface px-6 font-bold text-ink transition hover:bg-surface-low active:scale-[0.98]" href="/login">
              Sudah punya akun
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">Gratis dipakai • Tanpa kartu kredit • Bahasa Indonesia</p>
        </div>

        <div className="lp-hero-in" style={{ animationDelay: "0.15s" }}>
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}


/** Stylized phone mock showing a voice-capture result — concrete, not generic. */
function HeroPreview() {
  return (
    <div className="lp-float relative mx-auto w-full max-w-sm">
      <span aria-hidden className="lp-pulse-ring absolute -right-3 -top-3 size-16 rounded-full bg-income/30" />
      <div className="rounded-[2rem] border border-outline bg-surface p-5 shadow-lift">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-muted">Input Suara</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-1 text-[11px] font-bold text-secondary">
            <Sparkles size={11} /> AI
          </span>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface-low p-4">
          <span className="flex size-11 items-center justify-center rounded-full bg-income text-white">
            <Mic size={20} />
          </span>
          <p className="text-sm font-semibold leading-snug">&ldquo;Beli kopi 25 ribu di Kopi Kenangan&rdquo;</p>
        </div>
        <div className="mt-4 space-y-2 rounded-2xl border border-outline p-4">
          <PreviewRow label="Nominal" value="Rp25.000" />
          <PreviewRow label="Merchant" value="Kopi Kenangan" />
          <PreviewRow label="Kategori" value="Makan & Minum" />
          <PreviewRow label="Dompet" value="Cash" />
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-bold text-ink">{value}</span>
    </div>
  );
}


const FEATURES = [
  {
    icon: Mic,
    title: "Input Suara",
    body: "Ucapkan \"makan siang 50 ribu pakai GoPay\" — nominal, kategori, dan dompet terisi otomatis. Kalimat panjang ditangani AI.",
    tone: "text-income bg-income/10"
  },
  {
    icon: ReceiptText,
    title: "Scan Struk",
    body: "Foto struk belanja, QRIS, atau bukti transfer. AI membaca total, merchant, dan tanggal — tinggal koreksi bila perlu.",
    tone: "text-primary bg-primary/10"
  },
  {
    icon: PencilLine,
    title: "Catat Manual",
    body: "Form cepat dengan tipe, dompet, dan kategori dari master datamu. Cocok saat ingin kontrol penuh.",
    tone: "text-transfer bg-transfer/10"
  },
  {
    icon: Wallet,
    title: "Multi Dompet",
    body: "Cash, e-wallet, rekening bank, kartu kredit — semua brand lokal dengan warna otomatis dalam satu dashboard.",
    tone: "text-secondary bg-secondary/10"
  },
  {
    icon: Store,
    title: "Direktori Merchant",
    body: "Merchant populer lengkap dengan logo dan kategori. Tambah merchant pribadimu sendiri kapan saja.",
    tone: "text-warning bg-warning/10"
  },
  {
    icon: BarChart3,
    title: "Laporan & Ekspor Excel",
    body: "Lihat arus kas bulanan, kategori boros, dan tren pengeluaran — lalu ekspor ke Excel untuk arsip atau pajak.",
    tone: "text-expense bg-expense/10"
  },
  {
    icon: Landmark,
    title: "Hutang & Piutang",
    body: "Pantau cicilan, tenor, dan bunga. Catat pembayaran yang langsung mengurangi sisa hutang dan saldo dompet.",
    tone: "text-primary bg-primary/10"
  },
  {
    icon: HandCoins,
    title: "Pinjaman Teman",
    body: "Lacak siapa berutang padamu dan kapan jatuh tempo, lengkap dengan riwayat pembayaran yang rapi.",
    tone: "text-income bg-income/10"
  },
  {
    icon: Bell,
    title: "Pengingat Tagihan",
    body: "Atur reminder tagihan rutin agar tidak telat bayar — tandai lunas sekali ketuk saat sudah dibayar.",
    tone: "text-warning bg-warning/10"
  },
  {
    icon: WifiOff,
    title: "PWA & Offline",
    body: "Pasang seperti aplikasi di ponsel. Tetap bisa mencatat saat offline — data tersinkron begitu online kembali.",
    tone: "text-transfer bg-transfer/10"
  }
] as const;

const STATS = [
  { value: "3 cara", label: "Suara, struk, & manual" },
  { value: "< 5 dtk", label: "Per transaksi" },
  { value: "100%", label: "Bahasa Indonesia" },
  { value: "Offline", label: "Tetap jalan tanpa internet" }
] as const;

function StatsBand() {
  return (
    <section className="border-y border-outline/60 bg-surface/60">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-5 py-8 md:grid-cols-4">
        {STATS.map((stat, index) => (
          <Reveal key={stat.label} delay={index * 80} className="text-center">
            <p className="lp-gradient-text bg-gradient-to-r from-primary to-income bg-clip-text text-2xl font-extrabold text-transparent md:text-3xl">
              {stat.value}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted md:text-sm">{stat.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}


function Features() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Semua cara mencatat, dalam satu app</h2>
        <p className="mt-3 text-muted">Pilih cara tercepat sesuai momen — semuanya rapi otomatis ke dompet dan kategori yang tepat.</p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <Reveal key={feature.title} delay={(index % 3) * 90} as="article" className="group rounded-2xl border border-outline bg-surface p-6 shadow-card transition hover:-translate-y-1 hover:shadow-lift">
            <span className={`flex size-12 items-center justify-center rounded-xl ${feature.tone} transition-transform group-hover:scale-110`}>
              <feature.icon size={22} />
            </span>
            <h3 className="mt-4 text-lg font-bold">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { step: "01", title: "Tangkap transaksi", body: "Bicara, foto struk, atau ketik. Cukup beberapa detik per transaksi." },
  { step: "02", title: "AI merapikan", body: "Nominal, merchant, kategori, dan dompet terisi otomatis. Koreksi kalau perlu." },
  { step: "03", title: "Pantau keuangan", body: "Dashboard, riwayat, dan laporan memberi gambaran utuh arus kasmu." }
] as const;

function HowItWorks() {
  return (
    <section className="bg-surface-low py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Tiga langkah, beres</h2>
          <p className="mt-3 text-muted">Tanpa spreadsheet, tanpa ribet. MoneyFlow mengurus detailnya.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((item, index) => (
            <Reveal key={item.step} delay={index * 120} className="relative rounded-2xl border border-outline bg-surface p-6 shadow-card transition hover:-translate-y-1 hover:shadow-lift">
              <span className="text-4xl font-extrabold text-primary/25">{item.step}</span>
              <h3 className="mt-2 text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-tertiary px-6 py-14 text-center text-white shadow-lift">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -left-10 size-48 rounded-full bg-white/10 blur-2xl" />
        <h2 className="relative text-3xl font-extrabold tracking-tight md:text-4xl">Mulai rapikan keuanganmu hari ini</h2>
        <p className="relative mx-auto mt-3 max-w-md text-white/85">Gratis, cepat, dan dibuat untuk kebiasaan finansial orang Indonesia.</p>
        <Link
          className="relative mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-7 font-bold text-primary shadow-card transition active:scale-[0.98]"
          href="/register"
        >
          Buat Akun Gratis
          <ArrowRight size={18} />
        </Link>
        <p className="relative mt-4 flex items-center justify-center gap-1.5 text-xs text-white/80">
          <ShieldCheck size={14} />
          Data terenkripsi & privat
        </p>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-outline/60">
      <div className="mx-auto max-w-6xl px-5 py-10">
        {/* Top row: brand + auth links */}
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/brand-mark.svg" alt="MoneyFlow" className="size-7 rounded-lg" />
            <span className="font-bold">MoneyFlow</span>
          </div>
          <div className="flex gap-4 text-sm font-semibold text-muted">
            <Link className="hover:text-ink" href="#pricing">Harga</Link>
            <Link className="hover:text-ink" href="/login">Masuk</Link>
            <Link className="hover:text-ink" href="/register">Daftar</Link>
          </div>
        </div>

        {/* Legal links */}
        <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold text-muted">
          <Link className="hover:text-ink" href="/faq">FAQ</Link>
          <Link className="hover:text-ink" href="/syarat-ketentuan">Syarat &amp; Ketentuan</Link>
          <Link className="hover:text-ink" href="/kebijakan-refund">Kebijakan Refund</Link>
          <Link className="hover:text-ink" href="/kontak">Kontak</Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted">© {new Date().getFullYear()} MoneyFlow. Hak cipta dilindungi.</p>
      </div>
    </footer>
  );
}

