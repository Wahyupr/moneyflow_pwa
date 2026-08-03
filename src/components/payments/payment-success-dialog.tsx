"use client";

import { CheckCircle2, Crown, Zap, Sparkles } from "lucide-react";
import Link from "next/link";
import { getPlanHighlights } from "@/lib/plan-features";

type Plan = "premium" | "pro";

type PaymentSuccessDialogProps = {
  plan: Plan;
  onClose: () => void;
};

const PLAN_META: Record<Plan, { label: string; icon: React.ReactNode; gradient: string; ring: string; accent: string }> = {
  premium: {
    label: "Premium",
    icon: <Crown size={28} strokeWidth={2.2} />,
    gradient: "from-primary to-tertiary",
    ring: "ring-primary/25",
    accent: "text-primary",
  },
  pro: {
    label: "Pro",
    icon: <Zap size={28} strokeWidth={2.2} />,
    gradient: "from-amber-500 to-orange-500",
    ring: "ring-amber-400/30",
    accent: "text-amber-600 dark:text-amber-400",
  },
};

/**
 * Celebration modal shown after a payment is confirmed paid. Plan-aware:
 * shows the highlight features unlocked by the plan the user just bought.
 * Triggered by the Snap onSuccess callback and by a sync/webhook "paid" result.
 */
export function PaymentSuccessDialog({ plan, onClose }: PaymentSuccessDialogProps) {
  const meta = PLAN_META[plan] ?? PLAN_META.premium;
  const features = getPlanHighlights(plan);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-success-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-md flex-col rounded-t-3xl bg-surface shadow-lift sm:rounded-3xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
        {/* Header with gradient banner */}
        <div className={`relative overflow-hidden rounded-t-3xl bg-gradient-to-br ${meta.gradient} px-6 pb-8 pt-9 text-center text-white`}>
          {/* Decorative glow */}
          <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-12 -left-6 size-32 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />

          <div className="relative mx-auto flex size-[68px] items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-3xl bg-white/25" aria-hidden="true" />
            <div className={`relative flex size-[68px] items-center justify-center rounded-3xl bg-white/20 ring-4 ${meta.ring} backdrop-blur-sm`}>
              {meta.icon}
            </div>
            <span className="absolute -right-1.5 -top-1.5 flex size-8 items-center justify-center rounded-full bg-income text-white shadow-card ring-2 ring-white/40">
              <CheckCircle2 size={17} />
            </span>
          </div>

          <div className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] backdrop-blur-sm">
            <Sparkles size={12} />
            Paket {meta.label} Aktif
          </div>
          <h3 id="payment-success-title" className="relative mt-2.5 text-2xl font-extrabold">
            Selamat! 🎉
          </h3>
          <p className="relative mx-auto mt-1 max-w-xs text-sm leading-5 text-white/85">
            Pembayaranmu berhasil dan paket {meta.label} sekarang aktif penuh.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="px-6 py-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
            Yang kamu dapatkan
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <li
                  key={feature.label}
                  className="flex items-center gap-2.5 rounded-xl border border-outline/50 bg-surface-low/50 px-3 py-2.5"
                >
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${meta.gradient} text-white`}>
                    <Icon size={14} />
                  </span>
                  <span className="text-[13px] font-semibold leading-tight text-ink">{feature.label}</span>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex flex-col gap-2">
            <Link
              href="/dashboard"
              onClick={onClose}
              className={`flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${meta.gradient} py-3.5 text-sm font-bold text-white shadow-card transition hover:brightness-105 active:scale-[0.98]`}
            >
              Mulai Pakai Sekarang
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl py-2.5 text-sm font-bold text-muted transition hover:bg-surface-container"
            >
              Nanti saja
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
