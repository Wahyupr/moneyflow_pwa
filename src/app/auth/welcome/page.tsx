"use client";

import {
  ArrowRight,
  Bell,
  Brain,
  CheckCircle2,
  Clock,
  Crown,
  FileText,
  Loader2,
  Sparkles,
  Wallet,
  type LucideIcon
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PlanTier = "free" | "premium";
type Stage = "loading" | "premium";

type PremiumFeature = {
  icon: LucideIcon;
  label: string;
  sublabel: string;
  inDevelopment?: boolean;
};

const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    icon: Wallet,
    label: "Dompet tanpa batas",
    sublabel: "Buat dompet sebanyak yang Anda butuhkan"
  },
  {
    icon: Brain,
    label: "AI Insight di Dashboard",
    sublabel: "Refill insight tanpa batas harian"
  },
  {
    icon: FileText,
    label: "AI Insight di Laporan",
    sublabel: "Analisis mendalam tanpa batas"
  },
  {
    icon: Clock,
    label: "Hutang & Piutang",
    sublabel: "Kelola pinjaman masuk & keluar dengan progress pelunasan"
  },
  {
    icon: Bell,
    label: "Pengingat Jatuh Tempo",
    sublabel: "Notifikasi otomatis untuk langganan & tagihan rutin"
  }
];

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-welcome-title"
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-surface p-6 shadow-lift">
        <div className="text-center">
          <div className="relative mx-auto mb-3 flex size-16 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-tertiary/25" aria-hidden="true" />
            <div className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-tertiary text-white shadow-card">
              <Crown aria-hidden="true" size={26} strokeWidth={2.4} />
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-tertiary">
            <Sparkles aria-hidden="true" size={12} />
            Premium Aktif
          </span>

          <h2 id="premium-welcome-title" className="mt-3 text-xl font-bold text-ink">
            Selamat!
          </h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-5 text-muted">
            Akun Anda telah berhasil di-upgrade ke Premium. Semua fitur premium sekarang aktif.
          </p>
        </div>

        <ul className="mt-5 space-y-2">
          {PREMIUM_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <li
                key={feature.label}
                className="flex items-start gap-3 rounded-xl border border-outline/40 bg-surface-container/40 p-2.5"
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                    feature.inDevelopment ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon aria-hidden="true" size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold leading-tight text-ink">
                    {feature.label}
                    {feature.inDevelopment ? (
                      <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
                        Segera
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs leading-tight text-muted">{feature.sublabel}</p>
                </div>
                {!feature.inDevelopment ? (
                  <CheckCircle2 aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-tertiary" />
                ) : null}
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={onContinue}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-white shadow-card transition hover:bg-primary-container active:scale-[0.98]"
        >
          Mulai
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </div>
    </div>
  );
}
