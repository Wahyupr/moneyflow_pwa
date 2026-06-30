"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Lock, ChevronDown, Sparkles, ArrowRight } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

// Feature rows: [label, free value/bool, premium value/bool]
const FEATURE_ROWS: Array<{
  label: string;
  free: string | boolean;
  premium: string | boolean;
  locked?: boolean; // true = locked on free
}> = [
  { label: "Dompet", free: "Maks. 2 dompet", premium: "Tak terbatas", locked: false },
  { label: "Budget aktif", free: "1 budget", premium: "Tak terbatas", locked: false },
  { label: "Riwayat transaksi", free: "3 bulan terakhir", premium: "Seluruh riwayat", locked: false },
  { label: "Input suara", free: false, premium: true, locked: true },
  { label: "Scan struk (AI)", free: false, premium: true, locked: true },
  { label: "Ekspor Excel", free: false, premium: true, locked: true },
  { label: "AI Insights", free: false, premium: true, locked: true },
  { label: "Hutang & Piutang", free: false, premium: true, locked: true },
  { label: "Pengingat tagihan", free: true, premium: true, locked: false },
  { label: "Multi dompet berbagi", free: false, premium: true, locked: true },
];

const FAQ_ITEMS = [
  {
    q: "Apakah bisa downgrade ke Free?",
    a: "Bisa. Datamu tetap aman — fitur premium hanya dinonaktifkan. Dompet dan budget yang melebihi batas free akan dibekukan sementara, bukan dihapus.",
  },
  {
    q: "Bagaimana cara pembayaran?",
    a: "Transfer bank, QRIS, atau dompet digital (GoPay, OVO, Dana). Invoice dikirim otomatis ke emailmu setelah pembayaran dikonfirmasi.",
  },
  {
    q: "Apakah ada uji coba gratis untuk Premium?",
    a: "Ya — setiap akun baru mendapat 14 hari Premium gratis tanpa kartu kredit. Setelah itu otomatis kembali ke Free kecuali kamu berlangganan.",
  },
];

const MONTHLY_PRICE = 49_000;
const YEARLY_PRICE_PER_MONTH = 39_200; // 20% off

function formatRp(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const price = yearly ? YEARLY_PRICE_PER_MONTH : MONTHLY_PRICE;

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      {/* Header */}
      <Reveal className="mx-auto max-w-xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-outline bg-surface px-3 py-1 text-xs font-bold text-primary shadow-card">
          <Sparkles size={13} />
          Pilih Paket
        </span>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
          Gratis untuk mulai,{" "}
          <span className="lp-gradient-text bg-gradient-to-r from-primary to-tertiary bg-clip-text text-transparent">
            Premium untuk serius
          </span>
        </h2>
        <p className="mt-3 text-muted">
          Semua fitur inti gratis. Upgrade kalau butuh lebih — tidak ada trik tersembunyi.
        </p>
      </Reveal>

      {/* Billing toggle */}
      <Reveal delay={80} className="mt-8 flex items-center justify-center gap-3">
        <span className={`text-sm font-semibold transition ${!yearly ? "text-ink" : "text-muted"}`}>
          Bulanan
        </span>
        <button
          onClick={() => setYearly((v) => !v)}
          role="switch"
          aria-checked={yearly}
          aria-label="Toggle billing period"
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
            yearly ? "bg-primary" : "bg-outline"
          }`}
        >
          <span
            className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
              yearly ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className={`flex items-center gap-1.5 text-sm font-semibold transition ${yearly ? "text-ink" : "text-muted"}`}>
          Tahunan
          <span className="rounded-full bg-income/15 px-2 py-0.5 text-[10px] font-bold text-income">
            Hemat 20%
          </span>
        </span>
      </Reveal>

      {/* Cards */}
      <div className="mt-10 grid gap-6 md:grid-cols-2 md:items-start">
        {/* Free card */}
        <Reveal delay={100} className="rounded-2xl border border-outline bg-surface p-7 shadow-card">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Free</p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight">Rp0</p>
          <p className="mt-1 text-sm text-muted">Selamanya gratis</p>

          <Link
            href="/register"
            className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/60 font-bold text-primary transition hover:bg-primary/5 active:scale-[0.98]"
          >
            Mulai Gratis
            <ArrowRight size={16} />
          </Link>

          <ul className="mt-7 space-y-3">
            {FEATURE_ROWS.map((row) => (
              <FeatureRowFree key={row.label} row={row} />
            ))}
          </ul>
        </Reveal>

        {/* Premium card */}
        <Reveal delay={160} className="relative">
          {/* Popular badge */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-tertiary px-4 py-1.5 text-xs font-bold text-white shadow-lift">
              <Sparkles size={11} />
              Paling Populer
            </span>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-primary to-tertiary p-7 text-white shadow-lift ring-2 ring-primary/30">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">Premium</p>
            <div className="mt-2 flex items-end gap-1.5">
              <p className="text-4xl font-extrabold tracking-tight">{formatRp(price)}</p>
              <span className="mb-1 text-sm text-white/70">/bln</span>
            </div>
            {yearly ? (
              <p className="mt-1 text-sm text-white/70">
                Ditagih tahunan ({formatRp(YEARLY_PRICE_PER_MONTH * 12)}/thn)
              </p>
            ) : (
              <p className="mt-1 text-sm text-white/70">
                Atau {formatRp(YEARLY_PRICE_PER_MONTH)}/bln jika bayar tahunan
              </p>
            )}

            <Link
              href="/register"
              className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white font-bold text-primary shadow-card transition hover:shadow-[0_8px_30px_rgba(255,255,255,0.25)] active:scale-[0.98]"
            >
              Coba 14 Hari Gratis
              <ArrowRight size={16} />
            </Link>

            <ul className="mt-7 space-y-3">
              {FEATURE_ROWS.map((row) => (
                <FeatureRowPremium key={row.label} row={row} />
              ))}
            </ul>
          </div>
        </Reveal>
      </div>

      {/* FAQ */}
      <Reveal delay={120} className="mx-auto mt-14 max-w-2xl">
        <h3 className="mb-5 text-center text-lg font-bold">Pertanyaan umum</h3>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="rounded-2xl border border-outline bg-surface shadow-card">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-bold"
              >
                {item.q}
                <ChevronDown
                  size={17}
                  className={`shrink-0 text-muted transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                />
              </button>
              {openFaq === i && (
                <p className="border-t border-outline px-5 pb-4 pt-3 text-sm leading-relaxed text-muted">
                  {item.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeatureRowFree({ row }: { row: (typeof FEATURE_ROWS)[number] }) {
  const isLocked = row.free === false;
  return (
    <li className={`flex items-start gap-3 text-sm ${isLocked ? "opacity-50" : ""}`}>
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
        {isLocked ? (
          <Lock size={13} className="text-muted" />
        ) : (
          <Check size={15} className="text-income" strokeWidth={2.5} />
        )}
      </span>
      <span className={isLocked ? "text-muted" : "text-ink"}>
        {typeof row.free === "string" ? row.free : row.label}
      </span>
    </li>
  );
}

function FeatureRowPremium({ row }: { row: (typeof FEATURE_ROWS)[number] }) {
  const val = row.premium;
  return (
    <li className="flex items-start gap-3 text-sm text-white">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
        <Check size={15} className="text-white" strokeWidth={2.5} />
      </span>
      <span>{typeof val === "string" ? val : row.label}</span>
    </li>
  );
}
