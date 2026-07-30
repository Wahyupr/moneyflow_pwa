"use client";

import {
  ArrowRight,
  CheckCircle2,
  Crown,
  Loader2,
  MessageSquare,
  ReceiptText,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PREMIUM_HIGHLIGHTS } from "@/lib/plan-features";

/**
 * Post-registration interstitial.
 *
 * Flow:
 *   loading → (trial_eligible) offer → success → redirect
 *           → (not eligible)    redirect immediately
 *
 * The 7-day Premium trial is no longer auto-granted at sign-up. Instead the
 * user is offered it here and must tap "Aktifkan" to claim it (POST
 * /api/trial/claim). On success we show a celebration dialog and the backend
 * has already logged the "welcome to Premium" notification.
 */
type Stage = "loading" | "offer" | "success";

export default function WelcomePage() {
  const [stage, setStage] = useState<Stage>("loading");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const nextRef = useRef<string>("/dashboard");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const target = params.get("next");
    if (target && target.startsWith("/") && !target.startsWith("//")) {
      nextRef.current = target;
    }

    let cancelled = false;

    async function bootstrap() {
      let eligible = false;
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          eligible = Boolean(json.trial_eligible);
        }
      } catch {
        // Fall back to immediate redirect if the profile fetch fails.
      }

      if (cancelled) return;

      if (eligible) {
        setStage("offer");
        return;
      }

      // Not eligible (already claimed / already premium): head straight in.
      window.location.replace(nextRef.current);
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  function continueToNext() {
    window.location.replace(nextRef.current);
  }

  async function claimTrial() {
    if (claiming) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await fetch("/api/trial/claim", { method: "POST" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setClaimError(json.error ?? "Gagal mengaktifkan trial. Coba lagi.");
        return;
      }

      // Whether newly claimed or already active, surface the celebration.
      setStage("success");
    } catch {
      setClaimError("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setClaiming(false);
    }
  }

  if (stage === "offer") {
    return (
      <TrialOfferDialog
        claiming={claiming}
        error={claimError}
        onClaim={claimTrial}
        onSkip={continueToNext}
      />
    );
  }

  if (stage === "success") {
    return <PremiumCelebrationDialog onContinue={continueToNext} />;
  }

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center bg-background">
      <Loader2 aria-hidden="true" className="size-6 animate-spin text-primary" />
    </main>
  );
}


const PRO_EXCLUSIVE = [
  { icon: MessageSquare, label: "AI Asisten Chat interaktif" },
  { icon: ReceiptText, label: "Scan struk tanpa batas" },
  { icon: Sparkles, label: "Prioritas fitur terbaru" },
];

/**
 * The trial *offer* — shown to eligible users before they claim. Claiming is an
 * explicit action (onClaim) so the trial only starts once the user opts in.
 */
function TrialOfferDialog({
  claiming,
  error,
  onClaim,
  onSkip,
}: {
  claiming: boolean;
  error: string | null;
  onClaim: () => void;
  onSkip: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-offer-title"
    >
      <div className="flex w-full max-w-md flex-col rounded-3xl bg-surface shadow-lift animate-in zoom-in-95 duration-300 max-h-[92dvh] sm:max-h-[95dvh]">
        {/* Gradient header */}
        <div className="relative flex-shrink-0 overflow-hidden rounded-t-3xl bg-gradient-to-br from-primary to-tertiary px-6 pb-8 pt-9 text-center text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-12 -left-6 size-32 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />

          <div className="relative mx-auto flex size-[68px] items-center justify-center">
            <div className="relative flex size-[68px] items-center justify-center rounded-3xl bg-white/20 ring-4 ring-primary/25 backdrop-blur-sm">
              <Crown aria-hidden="true" size={28} strokeWidth={2.2} />
            </div>
          </div>

          <div className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] backdrop-blur-sm">
            <Sparkles aria-hidden="true" size={12} />
            Gratis 7 Hari
          </div>
          <h2 id="trial-offer-title" className="relative mt-2.5 text-2xl font-extrabold">
            Coba Premium Gratis 🎁
          </h2>
          <p className="relative mx-auto mt-1 max-w-xs text-sm leading-5 text-white/85">
            Nikmati semua fitur Premium selama 7 hari penuh. Tanpa kartu kredit, tanpa biaya.
          </p>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="px-6 pt-5 pb-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
              Yang kamu dapatkan
            </p>
            <ul className="grid grid-cols-1 gap-2">
              {PREMIUM_HIGHLIGHTS.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li
                    key={feature.label}
                    className="flex items-center gap-2.5 rounded-xl border border-outline/50 bg-surface-low/50 px-3 py-2.5"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-tertiary text-white">
                      <Icon aria-hidden="true" size={14} />
                    </span>
                    <span className="min-w-0 text-[13px] font-semibold leading-tight text-ink">{feature.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Sticky footer CTA */}
        <div className="flex-shrink-0 border-t border-outline/30 px-6 pb-6 pt-4">
          {error ? (
            <p className="mb-3 rounded-lg bg-[#ffdad6] p-3 text-center text-sm text-[#93000a]">{error}</p>
          ) : null}
          <button
            type="button"
            onClick={onClaim}
            disabled={claiming}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-tertiary px-4 text-sm font-bold text-white shadow-lift transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {claiming ? (
              <>
                <Loader2 aria-hidden="true" size={18} className="animate-spin" />
                Mengaktifkan…
              </>
            ) : (
              <>
                Aktifkan Sekarang
                <ArrowRight aria-hidden="true" size={18} />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={claiming}
            className="mt-2 flex min-h-10 w-full items-center justify-center rounded-xl px-4 text-[13px] font-semibold text-muted transition hover:text-ink active:scale-[0.98] disabled:opacity-60"
          >
            Nanti saja
          </button>
        </div>
      </div>
    </div>
  );
}

function PremiumCelebrationDialog({ onContinue }: { onContinue: () => void }) {

  function goToPricing() {
    window.location.href = "/pricing";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-welcome-title"
    >
      <div className="flex w-full max-w-md flex-col rounded-3xl bg-surface shadow-lift animate-in zoom-in-95 duration-300 max-h-[92dvh] sm:max-h-[95dvh]">
        {/* Gradient header */}
        <div className="relative flex-shrink-0 overflow-hidden rounded-t-3xl bg-gradient-to-br from-primary to-tertiary px-6 pb-8 pt-9 text-center text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-12 -left-6 size-32 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />

          <div className="relative mx-auto flex size-[68px] items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-3xl bg-white/25" aria-hidden="true" />
            <div className="relative flex size-[68px] items-center justify-center rounded-3xl bg-white/20 ring-4 ring-primary/25 backdrop-blur-sm">
              <Crown aria-hidden="true" size={28} strokeWidth={2.2} />
            </div>
            <span className="absolute -right-1.5 -top-1.5 flex size-8 items-center justify-center rounded-full bg-income text-white shadow-card ring-2 ring-white/40">
              <CheckCircle2 size={17} />
            </span>
          </div>

          <div className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] backdrop-blur-sm">
            <Sparkles aria-hidden="true" size={12} />
            Uji Coba Premium
          </div>
          <h2 id="premium-welcome-title" className="relative mt-2.5 text-2xl font-extrabold">
            Selamat Datang! 🎉
          </h2>
          <p className="relative mx-auto mt-1 max-w-xs text-sm leading-5 text-white/85">
            Kamu dapat 7 hari Premium gratis. Semua fitur di bawah aktif tanpa kartu kredit.
          </p>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Feature highlights */}
          <div className="px-6 pt-5 pb-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
              Fitur yang terbuka
            </p>
            <ul className="grid grid-cols-1 gap-2">
              {PREMIUM_HIGHLIGHTS.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li
                    key={feature.label}
                    className="flex items-center gap-2.5 rounded-xl border border-outline/50 bg-surface-low/50 px-3 py-2.5"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-tertiary text-white">
                      <Icon aria-hidden="true" size={14} />
                    </span>
                    <span className="min-w-0 text-[13px] font-semibold leading-tight text-ink">{feature.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Pro upsell */}
          <div className="mx-6 mb-5 rounded-2xl border border-amber-200/60 bg-amber-50/60 px-4 py-4 dark:border-amber-800/40 dark:bg-amber-950/30">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                  <Zap aria-hidden="true" size={13} strokeWidth={2.5} />
                </span>
                <span className="text-[13px] font-extrabold text-amber-900 dark:text-amber-200">
                  Mau lebih? Coba Pro
                </span>
              </div>
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                +Rp10.000/bln
              </span>
            </div>
            <p className="mb-3 text-[12px] leading-relaxed text-amber-800/80 dark:text-amber-300/70">
              Hanya selisih Rp10.000 dari Premium — buka fitur eksklusif yang bikin pencatatan jauh lebih pintar.
            </p>
            <ul className="space-y-1.5">
              {PRO_EXCLUSIVE.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li key={feature.label} className="flex items-center gap-2">
                    <Icon aria-hidden="true" size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="min-w-0 text-[12px] font-semibold text-amber-900 dark:text-amber-200">{feature.label}</span>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={goToPricing}
              className="mt-3.5 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-[13px] font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.98]"
            >
              Lihat Paket Pro
              <ArrowRight aria-hidden="true" size={15} />
            </button>
          </div>
        </div>

        {/* Sticky footer CTA */}
        <div className="flex-shrink-0 border-t border-outline/30 px-6 pb-6 pt-4">
          <button
            type="button"
            onClick={onContinue}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-outline bg-surface-low px-4 text-sm font-semibold text-ink transition hover:bg-surface active:scale-[0.98]"
          >
            Mulai Sekarang dengan Premium
            <ArrowRight aria-hidden="true" size={18} />
          </button>
          <p className="mt-2.5 text-center text-[11px] text-muted">
            Upgrade ke Pro kapan saja dari halaman Pengaturan
          </p>
        </div>
      </div>
    </div>
  );
}
