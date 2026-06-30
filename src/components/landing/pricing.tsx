"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Check, Lock, ChevronDown, Sparkles, ArrowRight, Zap, Loader2 } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

// ─── Plan definitions ────────────────────────────────────────────────────────

// CellValue: false = fitur dikunci, string = label yang ditampilkan
type CellValue = string | false;

interface FeatureRow {
  label: string;
  free: CellValue;
  premium: CellValue;
  pro: CellValue;
}

const FEATURE_ROWS: FeatureRow[] = [
  {
    label: "Dompet",
    free:    "Maks. 2 dompet",
    premium: "Jumlah dompet tak terbatas",
    pro:     "Jumlah dompet tak terbatas",
  },
  {
    label: "Budget aktif",
    free:    "1 budget aktif",
    premium: "Jumlah budget tak terbatas",
    pro:     "Jumlah budget tak terbatas",
  },
  {
    label: "Riwayat transaksi",
    free:    "3 bulan terakhir saja",
    premium: "Seluruh riwayat",
    pro:     "Seluruh riwayat",
  },
  {
    label: "Input suara",
    free:    "Voice input 1× sehari",
    premium: "Voice input unlimited",
    pro:     "Voice input unlimited",
  },
  {
    label: "Scan struk otomatis",
    free:    "7×/bln — AI baca & isi transaksi",
    premium: "Scan struk 2× sehari",
    pro:     "Scan struk tak terbatas",
  },
  {
    label: "Ekspor laporan Excel",
    free:    "1×/bln — unduh ringkasan transaksi",
    premium: "Unduh laporan unlimited",
    pro:     "Unduh laporan unlimited",
  },
  {
    label: "AI Insights",
    free:    "7× sebulan AI Insights",
    premium: "AI Insights tak terbatas",
    pro:     "AI Insights tak terbatas",
  },
  {
    label: "Hutang & Piutang",
    free:    "1 catatan hutang/piutang",
    premium: "Catat & lacak hutang/piutang tak terbatas",
    pro:     "Catat & lacak hutang/piutang tak terbatas",
  },
  {
    label: "Multi dompet berbagi",
    free:    "1 dompet bersama",
    premium: "Dompet bareng keluarga/pasangan tak terbatas",
    pro:     "Dompet bareng keluarga/pasangan tak terbatas",
  },
  {
    label: "Pengingat tagihan",
    free:    "Maks. 2 pengingat tagihan",
    premium: "Pengingat tagihan tak terbatas",
    pro:     "Pengingat tagihan tak terbatas",
  },
  {
    label: "Custom Merchant",
    free:    "Maks. 3 merchant kustom",
    premium: "Merchant kustom tak terbatas",
    pro:     "Merchant kustom tak terbatas",
  },
  {
    label: "Custom Kategori",
    free:    "Maks. 3 kategori kustom",
    premium: "Kategori kustom tak terbatas",
    pro:     "Kategori kustom tak terbatas",
  },
  {
    label: "AI Asisten Chat",
    free:    false,
    premium: false,
    pro:     "Tanya jawab keuangan interaktif",
  },
];

// ─── Pricing ─────────────────────────────────────────────────────────────────

export const PRICES = {
  premium: { monthly: 49_000, yearly_per_month: 39_200 },
  pro:     { monthly: 99_000, yearly_per_month: 79_200 },
} as const;

export function formatRp(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

/** Proration: what a Premium subscriber pays to upgrade to Pro */
export function getUpgradePrice(billing: "monthly" | "yearly"): number {
  if (billing === "yearly") {
    return PRICES.pro.yearly_per_month - PRICES.premium.yearly_per_month;
  }
  return PRICES.pro.monthly - PRICES.premium.monthly;
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

// FAQ items — "uji coba" hanya ditampilkan untuk user yang belum login
const FAQ_ITEMS_LOGGED_OUT = [
  {
    q: "Apakah bisa downgrade ke Free?",
    a: "Bisa. Datamu tetap aman — fitur premium hanya dinonaktifkan. Dompet dan budget yang melebihi batas free akan dibekukan sementara, bukan dihapus.",
  },
  {
    q: "Bagaimana cara pembayaran?",
    a: "Transfer bank, QRIS, atau dompet digital (GoPay, OVO, Dana). Invoice dikirim otomatis ke emailmu setelah pembayaran dikonfirmasi.",
  },
  {
    q: "Apakah ada uji coba gratis untuk Premium atau Pro?",
    a: "Ya — setiap akun baru mendapat 14 hari Premium gratis tanpa kartu kredit. Setelah itu otomatis kembali ke Free kecuali kamu berlangganan.",
  },
  {
    q: "Apa bedanya Premium dan Pro?",
    a: "Premium cocok untuk pengguna aktif harian dengan kuota scan & suara yang cukup besar. Pro cocok untuk kamu yang butuh kuota tak terbatas dan akses ke AI Asisten Chat untuk analisis keuangan interaktif.",
  },
];

const FAQ_ITEMS_LOGGED_IN = [
  {
    q: "Apakah bisa downgrade ke Free?",
    a: "Bisa. Datamu tetap aman — fitur premium hanya dinonaktifkan. Dompet dan budget yang melebihi batas free akan dibekukan sementara, bukan dihapus.",
  },
  {
    q: "Bagaimana cara pembayaran?",
    a: "Transfer bank, QRIS, atau dompet digital (GoPay, OVO, Dana). Invoice dikirim otomatis ke emailmu setelah pembayaran dikonfirmasi.",
  },
  {
    q: "Apa bedanya Premium dan Pro?",
    a: "Premium cocok untuk pengguna aktif harian dengan kuota scan & suara yang cukup besar. Pro cocok untuk kamu yang butuh kuota tak terbatas dan akses ke AI Asisten Chat untuk analisis keuangan interaktif.",
  },
];

// ─── Snap Pay Button ─────────────────────────────────────────────────────────

/**
 * Calls POST /api/payments/snap to get a Snap token, then opens the
 * Midtrans Snap popup. Falls back to redirect URL if popup is blocked.
 *
 * Requires window.snap (loaded from Midtrans CDN). We load it lazily so it
 * only executes client-side and only when the user clicks.
 */
function SnapPayButton({
  plan,
  billing,
  label,
  className,
  isLoggedIn,
}: {
  plan: "premium" | "pro";
  billing: "monthly" | "yearly";
  label: string;
  className?: string;
  isLoggedIn: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const handlePay = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsLogin(false);

    try {
      // Ensure Midtrans Snap JS is loaded
      if (typeof window !== "undefined" && !(window as unknown as Record<string, unknown>).snap) {
        await new Promise<void>((resolve, reject) => {
          const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "";
          const script    = document.createElement("script");
          const env       = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true"
            ? "app"
            : "app.sandbox";
          script.src      = `https://${env}.midtrans.com/snap/snap.js`;
          script.setAttribute("data-client-key", clientKey);
          script.onload   = () => resolve();
          script.onerror  = () => reject(new Error("Failed to load Snap JS"));
          document.head.appendChild(script);
        });
      }

      const res = await fetch("/api/payments/snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan, billing }),
      });

      if (res.status === 401) {
        if (!isLoggedIn) {
          // Guest user — redirect to login then back to pricing
          window.location.href = `/login?next=/pricing`;
        } else {
          // User was logged in but session expired — show re-login prompt, don't loop
          setNeedsLogin(true);
        }
        return;
      }

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Gagal membuat order.");
      }

      const { snapToken, redirectUrl } = await res.json() as {
        snapToken: string;
        redirectUrl: string;
      };

      const snap = (window as unknown as { snap?: { pay: (token: string, opts: unknown) => void } }).snap;
      if (snap?.pay) {
        snap.pay(snapToken, {
          onSuccess:  () => { window.location.href = "/dashboard?payment=success"; },
          onPending:  () => { window.location.href = "/pricing?payment=pending"; },
          onError:    () => { setError("Pembayaran gagal. Silakan coba lagi."); },
          onClose:    () => { /* user closed popup */ },
        });
      } else {
        // Popup blocked — use redirect
        window.location.href = redirectUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }, [plan, billing, isLoggedIn]);

  return (
    <div>
      <button
        onClick={handlePay}
        disabled={loading}
        className={className}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Memproses…
          </>
        ) : (
          <>
            {label}
            <ArrowRight size={16} />
          </>
        )}
      </button>
      {needsLogin && (
        <p className="mt-2 text-center text-xs font-medium text-red-400">
          Sesi kamu habis.{" "}
          <a
            href={`/login?next=/pricing`}
            className="underline font-bold"
          >
            Masuk ulang
          </a>{" "}
          lalu coba lagi.
        </p>
      )}
      {error && !needsLogin && (
        <p className="mt-2 text-center text-xs font-medium text-red-400">{error}</p>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PricingProps {
  /** True if the viewer already has a session. Hides trial copy & free CTA changes. */
  isLoggedIn?: boolean;
}

export function Pricing({ isLoggedIn = false }: PricingProps) {
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const premiumPrice = yearly ? PRICES.premium.yearly_per_month : PRICES.premium.monthly;
  const proPrice     = yearly ? PRICES.pro.yearly_per_month     : PRICES.pro.monthly;

  // CTA label: trial copy hanya untuk guest; logged-in user langsung upgrade
  const premiumCta = isLoggedIn ? "Upgrade ke Premium" : "Coba 14 Hari Gratis";
  const proCta     = isLoggedIn ? "Upgrade ke Pro"     : "Coba 14 Hari Gratis";

  const faqItems = isLoggedIn ? FAQ_ITEMS_LOGGED_IN : FAQ_ITEMS_LOGGED_OUT;

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      {/* Header */}
      <Reveal className="mx-auto max-w-xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-outline bg-surface px-3 py-1 text-xs font-bold text-primary shadow-card">
          <Sparkles size={13} />
          Pilih Paket
        </span>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight md:text-4xl" suppressHydrationWarning>
          Gratis untuk mulai,{" "}
          <span
            className="lp-gradient-text bg-gradient-to-r from-primary to-tertiary bg-clip-text text-transparent"
            suppressHydrationWarning
          >
            Pro untuk serius
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

      {/* Cards — 3-column grid */}
      <div className="mt-10 grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* Free card */}
        <Reveal delay={80} className="rounded-2xl border border-outline bg-surface p-7 shadow-card">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Free</p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight">Rp0</p>
          <p className="mt-1 text-sm text-muted">Selamanya gratis</p>

          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-outline font-bold text-muted transition hover:bg-surface-low active:scale-[0.98]"
            >
              Paket kamu saat ini
            </Link>
          ) : (
            <Link
              href="/register"
              className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/60 font-bold text-primary transition hover:bg-primary/5 active:scale-[0.98]"
            >
              Mulai Gratis
              <ArrowRight size={16} />
            </Link>
          )}

          <ul className="mt-7 space-y-3">
            {FEATURE_ROWS.map((row) => (
              <FeatureCell key={row.label} label={row.label} value={row.free} tier="free" />
            ))}
          </ul>
        </Reveal>

        {/* Premium card */}
        <Reveal delay={140} className="relative">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-tertiary px-4 py-1.5 text-xs font-bold text-white shadow-lift">
              <Sparkles size={11} />
              Paling Populer
            </span>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-primary to-tertiary p-7 text-white shadow-lift ring-2 ring-primary/30">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">Premium</p>
            <div className="mt-2 flex items-end gap-1.5">
              <p className="text-4xl font-extrabold tracking-tight">{formatRp(premiumPrice)}</p>
              <span className="mb-1 text-sm text-white/70">/bln</span>
            </div>
            {yearly ? (
              <p className="mt-1 text-sm text-white/70">
                Ditagih tahunan ({formatRp(PRICES.premium.yearly_per_month * 12)}/thn)
              </p>
            ) : (
              <p className="mt-1 text-sm text-white/70">
                Atau {formatRp(PRICES.premium.yearly_per_month)}/bln jika bayar tahunan
              </p>
            )}

            <SnapPayButton
              plan="premium"
              billing={yearly ? "yearly" : "monthly"}
              label={premiumCta}
              isLoggedIn={isLoggedIn}
              className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white font-bold text-primary shadow-card transition hover:shadow-[0_8px_30px_rgba(255,255,255,0.25)] active:scale-[0.98] disabled:opacity-70"
            />

            <ul className="mt-7 space-y-3">
              {FEATURE_ROWS.map((row) => (
                <FeatureCell key={row.label} label={row.label} value={row.premium} tier="premium" />
              ))}
            </ul>
          </div>
        </Reveal>

        {/* Pro card */}
        <Reveal delay={200} className="relative">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-xs font-bold text-white shadow-lift">
              <Zap size={11} />
              Terbaik
            </span>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-7 text-white shadow-lift ring-2 ring-amber-400/40">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">Pro</p>
            <div className="mt-2 flex items-end gap-1.5">
              <p className="text-4xl font-extrabold tracking-tight">{formatRp(proPrice)}</p>
              <span className="mb-1 text-sm text-white/70">/bln</span>
            </div>
            {yearly ? (
              <p className="mt-1 text-sm text-white/70">
                Ditagih tahunan ({formatRp(PRICES.pro.yearly_per_month * 12)}/thn)
              </p>
            ) : (
              <p className="mt-1 text-sm text-white/70">
                Atau {formatRp(PRICES.pro.yearly_per_month)}/bln jika bayar tahunan
              </p>
            )}

            {/* Proration note for Premium subscribers */}
            <div className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-xs text-white/90">
              <span className="font-bold">Sudah Premium?</span>
              {" "}Bayar selisih{" "}
              <span className="font-bold">
                {formatRp(getUpgradePrice(yearly ? "yearly" : "monthly"))}/bln
              </span>
              {" "}saja untuk upgrade ke Pro.
            </div>

            <SnapPayButton
              plan="pro"
              billing={yearly ? "yearly" : "monthly"}
              label={proCta}
              isLoggedIn={isLoggedIn}
              className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white font-bold text-amber-600 shadow-card transition hover:shadow-[0_8px_30px_rgba(255,255,255,0.25)] active:scale-[0.98] disabled:opacity-70"
            />

            <ul className="mt-7 space-y-3">
              {FEATURE_ROWS.map((row) => (
                <FeatureCell key={row.label} label={row.label} value={row.pro} tier="pro" />
              ))}
            </ul>
          </div>
        </Reveal>
      </div>

      {/* FAQ */}
      <Reveal delay={120} className="mx-auto mt-14 max-w-2xl">
        <h3 className="mb-5 text-center text-lg font-bold">Pertanyaan umum</h3>
        <div className="space-y-3">
          {faqItems.map((item, i) => (
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

// ─── Feature cell sub-component ──────────────────────────────────────────────

function FeatureCell({
  label,
  value,
  tier,
}: {
  label: string;
  value: CellValue;
  tier: "free" | "premium" | "pro";
}) {
  const isLocked = value === false;
  const isColored = tier === "premium" || tier === "pro";

  return (
    <li className={`flex items-start gap-3 text-sm ${isLocked ? "opacity-50" : ""}`}>
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
        {isLocked ? (
          <Lock size={13} className={isColored ? "text-white/50" : "text-muted"} />
        ) : (
          <Check
            size={15}
            className={isColored ? "text-white" : "text-income"}
            strokeWidth={2.5}
          />
        )}
      </span>
      <span className={isLocked ? (isColored ? "text-white/50" : "text-muted") : (isColored ? "text-white" : "text-ink")}>
        {typeof value === "string" ? value : label}
      </span>
    </li>
  );
}
