"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Lock, ChevronDown, Sparkles, ArrowRight, Zap, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { openSnap } from "@/lib/payments/snap-client";
import { PaymentSuccessDialog } from "@/components/payments/payment-success-dialog";

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
    free:    "Maks. 3 dompet",
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

// Prices live in the framework-agnostic lib so the server (snap route) and
// client share one source of truth. Re-exported here for existing importers.
export {
  PLAN_PRICE,
  FREE_TO_PRO_PRICE,
  PREMIUM_TO_PRO_PRICE,
  getCheckoutAmount,
  formatRp,
} from "@/lib/pricing";
import { PLAN_PRICE, PREMIUM_TO_PRO_PRICE, FREE_TO_PRO_PRICE, formatRp } from "@/lib/pricing";

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
    a: "Ya — setiap akun baru mendapat 7 hari Premium gratis tanpa kartu kredit. Setelah itu otomatis kembali ke Free kecuali kamu berlangganan.",
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
  label,
  className,
  isLoggedIn,
  onPaid,
}: {
  plan: "premium" | "pro";
  label: string;
  className?: string;
  isLoggedIn: boolean;
  onPaid: (plan: "premium" | "pro") => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const handlePay = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsLogin(false);

    try {
      const res = await fetch("/api/payments/snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
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
        // Safely parse error body — server may return empty body on 500
        let errMsg = `Error ${res.status}`;
        try {
          const body = await res.json() as { error?: string };
          if (body.error) errMsg = body.error;
        } catch {
          // empty body — use status code message
          if (res.status === 500) errMsg = "Server error. Cek konfigurasi Midtrans.";
          if (res.status === 502) errMsg = "Gagal terhubung ke Midtrans. Coba lagi.";
          if (res.status === 503) errMsg = "Server sedang tidak tersedia.";
        }
        throw new Error(errMsg);
      }

      let snapToken: string, redirectUrl: string, returnedOrderId: string;
      try {
        const body = await res.json() as { snapToken: string; redirectUrl: string; orderId: string };
        snapToken        = body.snapToken;
        redirectUrl      = body.redirectUrl;
        returnedOrderId  = body.orderId;
      } catch {
        throw new Error("Response tidak valid dari server.");
      }

      await openSnap(
        snapToken,
        {
          onSuccess: async () => {
            // Sync so the DB reflects "paid" before we celebrate.
            try {
              await fetch("/api/payments/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ order_id: returnedOrderId }),
              });
            } catch {
              // Non-fatal — webhook or a later sync will cover it.
            }
            onPaid(plan);
          },
          onPending: () => {
            // Store order_id so pricing page can sync when user comes back
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem("mf_last_order_id", returnedOrderId);
            }
            window.location.href = `/pricing?payment=pending&order_id=${encodeURIComponent(returnedOrderId)}`;
          },
          onError: () => { setError("Pembayaran gagal. Silakan coba lagi."); },
          onClose: () => { /* user closed popup */ },
        },
        redirectUrl
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }, [plan, isLoggedIn]);

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

// ─── Payment result banner (auto-sync on ?payment=finish/pending) ─────────────

function PaymentResultBanner({
  isLoggedIn,
  onPaid,
}: {
  isLoggedIn: boolean;
  onPaid: (plan: "premium" | "pro") => void;
}) {
  const params = useSearchParams();
  const payment = params?.get("payment") ?? null;
  const orderId = params?.get("order_id") ?? null;

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<"paid" | "pending" | "failed" | "expired" | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    // Auto-sync on ?payment=finish (Midtrans redirect flow) or ?payment=pending with order_id
    const shouldSync = payment === "finish" || (payment === "pending" && orderId);
    if (!shouldSync) return;

    // Determine order_id: from URL param or sessionStorage fallback
    const oid = orderId ?? (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("mf_last_order_id") : null);
    if (!oid) return;

    setSyncing(true);
    fetch("/api/payments/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ order_id: oid }),
    })
      .then((r) => r.json())
      .then((data: { status?: string; error?: string; plan?: string }) => {
        if (data.error) {
          setSyncError(data.error);
        } else {
          const status = (data.status ?? "pending") as typeof syncResult;
          setSyncResult(status);
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.removeItem("mf_last_order_id");
          }
          if (status === "paid" && (data.plan === "premium" || data.plan === "pro")) {
            onPaid(data.plan);
          }
        }
      })
      .catch(() => setSyncError("Gagal mengecek status pembayaran."))
      .finally(() => setSyncing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!payment && !syncResult) return null;

  // Syncing spinner
  if (syncing) {
    return (
      <div className="mx-5 mb-6 flex items-center gap-3 rounded-2xl bg-surface px-5 py-4 shadow-card">
        <Loader2 size={18} className="animate-spin text-primary" />
        <p className="text-sm font-semibold text-ink">Mengecek status pembayaran…</p>
      </div>
    );
  }

  // After sync
  if (syncResult === "paid") {
    return (
      <div className="mx-5 mb-6 flex items-center gap-3 rounded-2xl bg-income/10 px-5 py-4">
        <CheckCircle2 size={20} className="shrink-0 text-income" />
        <div className="flex-1">
          <p className="font-bold text-income">Pembayaran berhasil!</p>
          <p className="text-sm text-income/80">Langgananmu sudah aktif.</p>
        </div>
        <Link
          href="/dashboard"
          className="shrink-0 rounded-xl bg-income px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
        >
          Ke Dashboard
        </Link>
      </div>
    );
  }

  if (syncResult === "pending" || payment === "pending") {
    return (
      <div className="mx-5 mb-6 flex items-center gap-3 rounded-2xl bg-amber-500/10 px-5 py-4">
        <Clock size={20} className="shrink-0 text-amber-500" />
        <div>
          <p className="font-bold text-amber-600 dark:text-amber-400">Pembayaran menunggu konfirmasi</p>
          <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
            Selesaikan pembayaran, lalu kembali ke halaman ini — status akan diperbarui otomatis.
          </p>
        </div>
      </div>
    );
  }

  if (syncError || payment === "error") {
    return (
      <div className="mx-5 mb-6 flex items-center gap-3 rounded-2xl bg-expense/10 px-5 py-4">
        <AlertCircle size={20} className="shrink-0 text-expense" />
        <div>
          <p className="font-bold text-expense">Terjadi kesalahan</p>
          <p className="text-sm text-expense/80">{syncError ?? "Silakan coba lagi atau hubungi support."}</p>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PricingProps {
  /** True if the viewer already has a session. Hides trial copy & free CTA changes. */
  isLoggedIn?: boolean;
  /** The viewer's current active plan (from DB). Drives plan-aware CTAs & pricing. */
  currentPlan?: "free" | "premium" | "pro";
  /** ISO timestamp when the trial expires, or null if not on trial. */
  trialEndsAt?: string | null;
}

function formatTrialExpiry(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }) + " WIB";
}

export function Pricing({ isLoggedIn = false, currentPlan = "free", trialEndsAt = null }: PricingProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [paidDialog, setPaidDialog] = useState<{ plan: "premium" | "pro" } | null>(null);

  const handlePaid = useCallback((plan: "premium" | "pro") => {
    setPaidDialog({ plan });
  }, []);

  const isPremium = currentPlan === "premium";
  const isPro     = currentPlan === "pro";
  const isTrial   = !!trialEndsAt;

  // Pro price shown depends on the viewer's current plan (server enforces this too).
  const proDisplayPrice = isPremium ? PREMIUM_TO_PRO_PRICE : isLoggedIn ? PLAN_PRICE.pro : FREE_TO_PRO_PRICE;

  // CTA labels adapt to the current plan.
  const premiumCta = isPremium ? "Paket kamu saat ini" : isPro ? "Sudah di paket lebih tinggi" : isLoggedIn ? "Upgrade ke Premium" : "Coba 7 Hari Gratis";
  const proCta     = isPro ? "Paket kamu saat ini" : isPremium ? "Upgrade ke Pro" : isLoggedIn ? "Naik ke Pro" : "Coba 7 Hari Gratis";

  const faqItems = isLoggedIn ? FAQ_ITEMS_LOGGED_IN : FAQ_ITEMS_LOGGED_OUT;

  return (
    <section id="pricing" className="mx-auto max-w-6xl py-16 md:py-24">
      {paidDialog && (
        <PaymentSuccessDialog
          plan={paidDialog.plan}
          onClose={() => setPaidDialog(null)}
        />
      )}
      <Suspense fallback={null}>
        <PaymentResultBanner isLoggedIn={isLoggedIn} onPaid={handlePaid} />
      </Suspense>
      <div className="px-5">
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

      {/* Cards — 3-column grid */}
      <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* Free card */}
        <Reveal delay={80} className="rounded-2xl border border-outline bg-surface p-7 shadow-card">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Free</p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight">Rp0</p>
          <p className="mt-1 text-sm text-muted">Selamanya gratis</p>

          {isLoggedIn ? (
            <div className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-outline font-bold text-muted">
              {currentPlan === "free" ? "Paket kamu saat ini" : "Termasuk di paketmu"}
            </div>
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
              <p className="text-4xl font-extrabold tracking-tight">{formatRp(PLAN_PRICE.premium)}</p>
              <span className="mb-1 text-sm text-white/70">/bln</span>
            </div>
            <p className="mt-1 text-sm text-white/70">Tagihan bulanan, batalkan kapan saja</p>

            {isPremium && isTrial && trialEndsAt && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2.5 text-sm">
                <Clock size={14} className="shrink-0 text-white/80" />
                <div>
                  <span className="font-bold text-white">Free Trial 7 Hari</span>
                  <span className="ml-1 text-white/70">· berakhir</span>
                  <div className="mt-0.5 text-xs font-medium text-white/90">{formatTrialExpiry(trialEndsAt)}</div>
                </div>
              </div>
            )}

            {isPremium || isPro ? (
              <div className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/20 font-bold text-white">
                {premiumCta}
              </div>
            ) : (
              <SnapPayButton
                plan="premium"
                label={premiumCta}
                isLoggedIn={isLoggedIn}
                onPaid={handlePaid}
                className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white font-bold text-primary shadow-card transition hover:shadow-[0_8px_30px_rgba(255,255,255,0.25)] active:scale-[0.98] disabled:opacity-70"
              />
            )}

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
              <p className="text-4xl font-extrabold tracking-tight">{formatRp(proDisplayPrice)}</p>
              <span className="mb-1 text-sm text-white/70">{isPremium ? "sekali bayar" : "/bln"}</span>
            </div>
            {isPremium ? (
              <p className="mt-1 text-sm text-white/90">
                Harga upgrade khusus dari Premium — hanya {formatRp(PREMIUM_TO_PRO_PRICE)}.
              </p>
            ) : !isLoggedIn ? (
              <p className="mt-1 text-sm text-white/90">
                <span className="line-through text-white/50">{formatRp(PLAN_PRICE.pro)}</span>{" "}
                hemat {formatRp(PLAN_PRICE.pro - FREE_TO_PRO_PRICE)} untuk pengguna baru.
              </p>
            ) : (
              <p className="mt-1 text-sm text-white/70">Tagihan bulanan, batalkan kapan saja</p>
            )}

            {isPro && isTrial && trialEndsAt && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2.5 text-sm">
                <Clock size={14} className="shrink-0 text-white/80" />
                <div>
                  <span className="font-bold text-white">Free Trial 7 Hari</span>
                  <span className="ml-1 text-white/70">· berakhir</span>
                  <div className="mt-0.5 text-xs font-medium text-white/90">{formatTrialExpiry(trialEndsAt)}</div>
                </div>
              </div>
            )}

            {isPro ? (
              <div className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/20 font-bold text-white">
                {proCta}
              </div>
            ) : (
              <SnapPayButton
                plan="pro"
                label={proCta}
                isLoggedIn={isLoggedIn}
                onPaid={handlePaid}
                className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white font-bold text-amber-600 shadow-card transition hover:shadow-[0_8px_30px_rgba(255,255,255,0.25)] active:scale-[0.98] disabled:opacity-70"
              />
            )}

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
      </div>
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
