"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Receipt,
  XCircle,
  AlertCircle,
  ExternalLink,
  Crown,
  Zap,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentOrder = {
  id: string;
  order_id: string;
  plan: string;
  billing_cycle: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "expired";
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function planLabel(plan: string) {
  if (plan === "premium") return "Premium";
  if (plan === "pro") return "Pro";
  return plan;
}

function billingLabel(cycle: string) {
  return cycle === "yearly" ? "Tahunan" : "Bulanan";
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  paid: {
    label: "Berhasil",
    icon: <CheckCircle2 size={14} />,
    classes: "bg-income/10 text-income",
  },
  pending: {
    label: "Menunggu",
    icon: <Clock size={14} />,
    classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  failed: {
    label: "Gagal",
    icon: <XCircle size={14} />,
    classes: "bg-expense/10 text-expense",
  },
  expired: {
    label: "Kedaluwarsa",
    icon: <AlertCircle size={14} />,
    classes: "bg-muted/20 text-muted",
  },
};

function StatusBadge({ status }: { status: PaymentOrder["status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${cfg.classes}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Plan icon ────────────────────────────────────────────────────────────────

function PlanIcon({ plan }: { plan: string }) {
  if (plan === "pro") {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-card">
        <Zap size={18} />
      </div>
    );
  }
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-tertiary text-white shadow-card">
      <Crown size={18} />
    </div>
  );
}

// ─── Payment method label ─────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  credit_card:  "Kartu Kredit",
  gopay:        "GoPay",
  shopeepay:    "ShopeePay",
  other_qris:   "QRIS",
  qris:         "QRIS",
  permata_va:   "VA Permata",
  bca_va:       "VA BCA",
  bni_va:       "VA BNI",
  bri_va:       "VA BRI",
  cimb_va:      "VA CIMB",
  danamon_va:   "VA Danamon",
  echannel:     "Mandiri Bill",
  indomaret:    "Indomaret",
  alfamart:     "Alfamart",
};

function methodLabel(method: string | null) {
  if (!method) return "—";
  return METHOD_LABELS[method.toLowerCase()] ?? method;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-outline bg-surface px-6 py-14 text-center shadow-card">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
        <Receipt size={28} className="text-primary" />
      </div>
      <div>
        <p className="font-bold text-ink">Belum ada transaksi</p>
        <p className="mt-1 text-sm text-muted">
          Riwayat pembayaran paket Premium &amp; Pro akan muncul di sini.
        </p>
      </div>
      <Link
        href="/pricing"
        className="mt-2 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-card transition hover:opacity-90 active:scale-[0.97]"
      >
        <Crown size={14} />
        Lihat Paket
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentHistoryPage() {
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/payments/orders")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((json: { orders: PaymentOrder[] }) => {
        if (active) setOrders(json.orders ?? []);
      })
      .catch(() => {
        if (active) setError("Gagal memuat data. Coba lagi.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <AppFrame title="Riwayat Pembayaran" subtitle="Transaksi langganan kamu">
      <div className="mt-4 space-y-3 pb-8">

        {/* Summary card — only when there are paid orders */}
        {!loading && orders.some((o) => o.status === "paid") && (
          <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-tertiary p-4 text-white shadow-lift">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <CreditCard size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-white/70">Total dibayar</p>
              <p className="text-lg font-extrabold">
                {formatRp(
                  orders
                    .filter((o) => o.status === "paid")
                    .reduce((acc, o) => acc + o.amount, 0)
                )}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs font-bold text-white/70">Transaksi berhasil</p>
              <p className="text-lg font-extrabold">
                {orders.filter((o) => o.status === "paid").length}×
              </p>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface shadow-card" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-2xl border border-expense/30 bg-expense/8 px-4 py-3.5 text-sm font-semibold text-expense">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="overflow-hidden rounded-2xl bg-surface shadow-card"
              >
                {/* Top row */}
                <div className="flex items-center gap-3 p-4">
                  <PlanIcon plan={order.plan} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-ink">
                        MoneyFlow {planLabel(order.plan)}
                      </p>
                      <span className="rounded-full bg-surface-low px-2 py-0.5 text-[10px] font-bold text-muted uppercase tracking-wide">
                        {billingLabel(order.billing_cycle)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm font-bold text-primary">
                      {formatRp(order.amount)}
                      {order.billing_cycle === "yearly" && (
                        <span className="ml-1 font-normal text-muted">/thn</span>
                      )}
                    </p>
                  </div>

                  <StatusBadge status={order.status} />
                </div>

                {/* Details */}
                <div className="border-t border-outline/60 px-4 py-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <p className="text-muted">Tanggal</p>
                      <p className="mt-0.5 font-semibold text-ink">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                    {order.paid_at && (
                      <div>
                        <p className="text-muted">Dibayar</p>
                        <p className="mt-0.5 font-semibold text-ink">
                          {formatDate(order.paid_at)}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted">Metode</p>
                      <p className="mt-0.5 font-semibold text-ink">
                        {methodLabel(order.payment_method)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted">Order ID</p>
                      <p className="mt-0.5 font-mono text-[10px] font-semibold text-ink truncate">
                        {order.order_id}
                      </p>
                    </div>
                  </div>

                  {/* Retry button for pending orders */}
                  {order.status === "pending" && (
                    <Link
                      href="/pricing"
                      className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500/10 py-2 text-xs font-bold text-amber-600 transition hover:bg-amber-500/20 dark:text-amber-400"
                    >
                      <ExternalLink size={12} />
                      Selesaikan pembayaran
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Link to pricing */}
        <div className="pt-2">
          <Link
            href="/pricing"
            className="flex items-center justify-center gap-2 rounded-2xl border border-primary/30 py-3 text-sm font-bold text-primary transition hover:bg-primary/5 active:scale-[0.98]"
          >
            <Crown size={15} />
            Lihat atau ubah paket
          </Link>
        </div>

      </div>
    </AppFrame>
  );
}
