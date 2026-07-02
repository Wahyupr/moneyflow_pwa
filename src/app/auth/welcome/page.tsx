"use client";

import {
  ArrowRight,
  CheckCircle2,
  Crown,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PREMIUM_HIGHLIGHTS } from "@/lib/plan-features";

type PlanTier = "free" | "premium" | "pro";
type Stage = "loading" | "premium";

export default function WelcomePage() {
  const [stage, setStage] = useState<Stage>("loading");
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
      let plan: PlanTier = "free";
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          plan = (json.entitlement?.plan as PlanTier) ?? "free";
        }
      } catch {
        // Fall back to free flow (immediate redirect) if profile fetch fails.
      }

      if (cancelled) return;

      if (plan === "premium") {
        setStage("premium");
        return;
      }

      // Free plan: skip any interstitial and head straight to the app.
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

  if (stage === "premium") {
    return <PremiumCelebrationDialog onContinue={continueToNext} />;
  }

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center bg-background">
      <Loader2 aria-hidden="true" className="size-6 animate-spin text-primary" />
    </main>
  );
}

function PremiumCelebrationDialog({ onContinue }: { onContinue: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-welcome-title"
    >
      <div className="flex w-full max-w-md flex-col rounded-t-3xl bg-surface shadow-lift sm:rounded-3xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
        {/* Gradient header */}
        <div className="relative overflow-hidden rounded-t-3xl bg-gradient-to-br from-primary to-tertiary px-6 pb-8 pt-9 text-center text-white">
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

        {/* Feature highlights */}
        <div className="px-6 py-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
            Fitur yang terbuka
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                  <span className="text-[13px] font-semibold leading-tight text-ink">{feature.label}</span>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={onContinue}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-tertiary px-4 text-sm font-bold text-white shadow-card transition hover:brightness-105 active:scale-[0.98]"
          >
            Mulai Sekarang
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
