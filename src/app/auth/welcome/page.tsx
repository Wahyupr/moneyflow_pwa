"use client";

import {
  ArrowRight,
  Bell,
  Brain,
  CheckCircle2,
  Crown,
  FileText,
  HandCoins,
  Loader2,
  Mic,
  ReceiptText,
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
    sublabel: "Buat dompet sebanyak yang kamu butuhkan"
  },
  {
    icon: Mic,
    label: "Input Suara AI",
    sublabel: "AI parsing tanpa batas setiap hari"
  },
  {
    icon: ReceiptText,
    label: "Scan Struk",
    sublabel: "Scan & ekstrak struk tanpa batas"
  },
  {
    icon: Brain,
    label: "AI Insight",
    sublabel: "Insight dashboard & laporan tanpa batas"
  },
  {
    icon: HandCoins,
    label: "Hutang & Piutang",
    sublabel: "Kelola pinjaman dengan progress pelunasan"
  },
  {
    icon: Bell,
    label: "Pengingat Tagihan",
    sublabel: "Notifikasi otomatis untuk tagihan rutin"
  },
  {
    icon: FileText,
    label: "Laporan Lengkap",
    sublabel: "Ekspor Excel & riwayat semua waktu"
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

        <ul className="mt-4 grid grid-cols-2 gap-1.5">
          {PREMIUM_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <li
                key={feature.label}
                className="flex items-start gap-2 rounded-xl border border-outline/40 bg-surface-container/40 px-2.5 py-2"
              >
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${
                    feature.inDevelopment ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon aria-hidden="true" size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold leading-tight text-ink">
                    {feature.label}
                    {feature.inDevelopment ? (
                      <span className="ml-1 rounded-full bg-warning/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-warning">
                        Segera
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-px text-[10px] leading-tight text-muted">{feature.sublabel}</p>
                </div>
                {!feature.inDevelopment ? (
                  <CheckCircle2 aria-hidden="true" size={13} className="mt-0.5 shrink-0 text-tertiary" />
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
