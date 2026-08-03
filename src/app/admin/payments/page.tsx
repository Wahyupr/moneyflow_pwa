"use client";

import { useCallback, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { Toast, useToast } from "@/components/ui/toast";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  TrendingUp,
  UserRound,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Crown,
  Zap,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminPaymentOrder = {
  id: string;
  order_id: string;
  user_id: string;
  display_name: string | null;
  plan: string;
  billing_cycle: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "expired";
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
};

type Stats = {
  total_revenue: number;
  paid_count: number;
  pending_count: number;
  failed_count: number;
};

type Pagination = { page: number; limit: number; total: number; pages: number };

type ApiResponse = {
  orders: AdminPaymentOrder[];
  stats: Stats;
  pagination: Pagination;
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

const METHOD_LABELS: Record<string, string> = {
  credit_card: "Kartu Kredit",
  gopay: "GoPay",
  shopeepay: "ShopeePay",
  other_qris: "QRIS",
  qris: "QRIS",
  permata_va: "VA Permata",
  bca_va: "VA BCA",
  bni_va: "VA BNI",
  bri_va: "VA BRI",
  cimb_va: "VA CIMB",
  danamon_va: "VA Danamon",
  echannel: "Mandiri Bill",
  indomaret: "Indomaret",
  alfamart: "Alfamart",
};

function methodLabel(method: string | null) {
  if (!method) return "—";
  return METHOD_LABELS[method.toLowerCase()] ?? method;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  paid:    { label: "Berhasil",      icon: <CheckCircle2 size={12} />, classes: "bg-income/10 text-income" },
  pending: { label: "Menunggu",      icon: <Clock size={12} />,        classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  failed:  { label: "Gagal",         icon: <XCircle size={12} />,      classes: "bg-expense/10 text-expense" },
  expired: { label: "Kedaluwarsa",   icon: <AlertCircle size={12} />,  classes: "bg-muted/20 text-muted" },
};

function StatusBadge({ status }: { status: AdminPaymentOrder["status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.classes}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Plan badge ───────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  if (plan === "pro") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
        <Zap size={10} /> Pro
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
      <Crown size={10} /> Premium
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterPlan, setFilterPlan] = useState("");
  const [page, setPage] = useState(1);

  const { toast, showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (filterStatus) params.set("status", filterStatus);
    if (filterPlan)   params.set("plan",   filterPlan);

    const res = await fetch(`/api/admin/payments?${params.toString()}`);
    if (res.status === 403) { setForbidden(true); setLoading(false); return; }
    if (!res.ok) {
      showToast("Gagal memuat data pembayaran.", "error");
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }, [page, filterStatus, filterPlan, showToast]);

  useEffect(() => { void load(); }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filterStatus, filterPlan]);

  if (forbidden) {
    return (
      <AppFrame title="Admin Payments" subtitle="Riwayat pembayaran semua user">
        <div className="mt-10 rounded-2xl bg-surface p-6 text-center shadow-card">
          <p className="font-bold text-ink">Akses ditolak</p>
          <p className="mt-1 text-sm text-muted">Halaman ini hanya untuk admin.</p>
          <Link href="/admin" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
            ← Kembali ke Panel Admin
          </Link>
        </div>
      </AppFrame>
    );
  }

  const stats = data?.stats;
  const orders = data?.orders ?? [];
  const pagination = data?.pagination;

  return (
    <AppFrame title="Admin Payments" subtitle="Riwayat pembayaran semua user">
      <Toast toast={toast} />

      <div className="mt-4 space-y-4 pb-8">

        {/* Back link */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink"
        >
          <ChevronLeft size={16} />
          Panel Admin
        </Link>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<TrendingUp size={18} className="text-income" />}
            label="Total Pendapatan"
            value={stats ? formatRp(stats.total_revenue) : "—"}
            accent="bg-income/10"
          />
          <StatCard
            icon={<CheckCircle2 size={18} className="text-income" />}
            label="Transaksi Berhasil"
            value={stats ? String(stats.paid_count) : "—"}
            accent="bg-income/10"
          />
          <StatCard
            icon={<Clock size={18} className="text-amber-500" />}
            label="Menunggu Bayar"
            value={stats ? String(stats.pending_count) : "—"}
            accent="bg-amber-500/10"
          />
          <StatCard
            icon={<XCircle size={18} className="text-expense" />}
            label="Gagal / Expired"
            value={stats ? String(stats.failed_count) : "—"}
            accent="bg-expense/10"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 rounded-xl border border-outline bg-surface px-3 py-2.5 text-sm font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Semua Status</option>
            <option value="paid">Berhasil</option>
            <option value="pending">Menunggu</option>
            <option value="failed">Gagal</option>
            <option value="expired">Kedaluwarsa</option>
          </select>
          <select
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
            className="flex-1 rounded-xl border border-outline bg-surface px-3 py-2.5 text-sm font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Semua Paket</option>
            <option value="premium">Premium</option>
            <option value="pro">Pro</option>
          </select>
        </div>

        {/* Total indicator */}
        {pagination && (
          <p className="text-xs text-muted">
            Menampilkan {orders.length} dari {pagination.total} transaksi
          </p>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface shadow-card" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl bg-surface px-6 py-12 text-center shadow-card">
            <CreditCard size={28} className="mx-auto mb-3 text-muted" />
            <p className="font-bold text-ink">Tidak ada transaksi</p>
            <p className="mt-1 text-sm text-muted">
              {filterStatus || filterPlan ? "Coba ubah filter." : "Belum ada transaksi pembayaran."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <div key={order.id} className="overflow-hidden rounded-2xl bg-surface shadow-card">
                {/* Top */}
                <div className="flex items-start gap-3 p-3.5">
                  {/* User avatar */}
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">
                    {(order.display_name ?? "?")
                      .split(/\s+/)
                      .map((p) => p[0]?.toUpperCase() ?? "")
                      .slice(0, 2)
                      .join("")}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-xs font-semibold text-muted">
                        <UserRound size={11} />
                        {order.display_name ?? "Tanpa nama"}
                      </span>
                      <PlanBadge plan={order.plan} />
                      <span className="text-[10px] text-muted">
                        {order.billing_cycle === "yearly" ? "Tahunan" : "Bulanan"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-bold text-ink">{formatRp(order.amount)}</span>
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="border-t border-outline/60 px-3.5 py-2.5">
                  <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[11px]">
                    <div>
                      <p className="text-muted">Tanggal</p>
                      <p className="font-semibold text-ink">{formatDate(order.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-muted">Metode</p>
                      <p className="font-semibold text-ink">{methodLabel(order.payment_method)}</p>
                    </div>
                    <div>
                      <p className="text-muted">Order ID</p>
                      <p className="font-mono font-semibold text-ink truncate">{order.order_id.slice(-8)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1.5 rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-low disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Sebelumnya
            </button>
            <span className="text-sm text-muted">
              {page} / {pagination.pages}
            </span>
            <button
              type="button"
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1.5 rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-low disabled:opacity-40"
            >
              Berikutnya <ChevronRight size={16} />
            </button>
          </div>
        )}

      </div>
    </AppFrame>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-card">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="truncate font-extrabold text-ink">{value}</p>
      </div>
    </div>
  );
}
