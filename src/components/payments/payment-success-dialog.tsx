"use client";

import { CheckCircle2, Crown, Zap, Sparkles } from "lucide-react";
import Link from "next/link";

type Plan = "premium" | "pro";

type PaymentSuccessDialogProps = {
  plan: Plan;
  billing?: "monthly" | "yearly";
  onClose: () => void;
};

const PLAN_META: Record<Plan, { label: string; icon: React.ReactNode; gradient: string }> = {
  premium: {
    label: "Premium",
    icon: <Crown size={26} />,
    gradient: "from-primary to-tertiary",
  },
  pro: {
    label: "Pro",
    icon: <Zap size={26} />,
    gradient: "from-amber-500 to-orange-500",
  },
};

/**
 * Celebration modal shown after a payment is confirmed paid. Triggered by the
 * Snap onSuccess callback and by a sync/webhook result of "paid".
 */
export function PaymentSuccessDialog({ plan, billing, onClose }: PaymentSuccessDialogProps) {
  const meta = PLAN_META[plan] ?? PLAN_META.premium;
  const billingLabel = billing === "yearly" ? "Tahunan" : billing === "monthly" ? "Bulanan" : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-success-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-t-3xl bg-surface p-6 text-center shadow-lift sm:rounded-3xl">
        {/* Icon burst */}
        <div className="relative mt-2">
          <div className={`flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br ${meta.gradient} text-white shadow-lift`}>
            {meta.icon}
          </div>
          <span className="absolute -right-1 -top-1 flex size-8 items-center justify-center rounded-full bg-income text-white shadow-card">
            <CheckCircle2 size={18} />
          </span>
        </div>

        <div>
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            <Sparkles size={12} />
            Pembayaran Berhasil
          </div>
          <h3 id="payment-success-title" className="mt-2 text-xl font-extrabold text-ink">
            Selamat! Kamu sekarang {meta.label}
          </h3>
          <p className="mt-1.5 text-sm text-muted">
            Langgananmu sudah aktif{billingLabel ? ` (${billingLabel})` : ""}. Semua fitur {meta.label} siap kamu pakai.
          </p>
        </div>

        <div className="mt-1 flex w-full flex-col gap-2">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-card transition hover:opacity-90 active:scale-[0.98]"
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
  );
}
