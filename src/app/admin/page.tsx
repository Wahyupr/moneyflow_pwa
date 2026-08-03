"use client";

import { SlidersHorizontal, Users, Sparkles, CreditCard, Store, Tag, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppFrame } from "@/components/app-frame";
import { CategoryManager } from "@/components/category-manager";
import { MerchantManager } from "@/components/merchant-manager";
import { Toast, useToast } from "@/components/ui/toast";

/**
 * Admin hub. Heavy management surfaces now live on dedicated pages so each is
 * easy to reason about and link to:
 *   - /admin/plans     → plan limits + AI credit configuration
 *   - /admin/users     → users & subscriptions
 *   - /admin/ai-usage  → AI credit monitoring dashboard
 *   - /admin/payments  → payment history (existing)
 * Merchant & category directories stay inline since they're small editors.
 */
export default function AdminPage() {
  return (
    <AppFrame title="Admin" subtitle="Pusat kontrol aplikasi">
      <AdminHub />
    </AppFrame>
  );
}

const NAV_ITEMS: Array<{
  href: string;
  title: string;
  subtitle: string;
  icon: typeof Users;
  tint: string;
}> = [
  {
    href: "/admin/plans",
    title: "Paket & Kredit AI",
    subtitle: "Atur limit fitur dan kredit AI per paket",
    icon: SlidersHorizontal,
    tint: "bg-primary/10 text-primary"
  },
  {
    href: "/admin/users",
    title: "User & Subscription",
    subtitle: "Kelola plan dan pantau kredit tiap user",
    icon: Users,
    tint: "bg-violet-500/10 text-violet-600"
  },
  {
    href: "/admin/ai-usage",
    title: "Pemantauan AI",
    subtitle: "Dashboard pemakaian kredit AI",
    icon: Sparkles,
    tint: "bg-amber-500/10 text-amber-600"
  },
  {
    href: "/admin/payments",
    title: "Riwayat Pembayaran",
    subtitle: "Semua transaksi & pendapatan",
    icon: CreditCard,
    tint: "bg-income/10 text-income"
  }
];

function AdminHub() {
  const [forbidden, setForbidden] = useState(false);
  const { toast, showToast } = useToast();
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    // Cheap admin probe reusing an existing admin-only endpoint.
    void fetch("/api/admin/users").then((res) => {
      if (res.status === 403) setForbidden(true);
    });
  }, []);

  useEffect(() => {
    if (status) {
      showToast(status, status.startsWith("Gagal") ? "error" : "success");
      setStatus(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (forbidden) {
    return (
      <div className="mt-6 rounded-2xl bg-surface p-6 text-center shadow-card">
        <p className="font-bold text-ink">Akses ditolak</p>
        <p className="mt-2 text-sm text-muted">Halaman ini hanya untuk admin.</p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-5">
      <Toast toast={toast} />

      {/* ── Navigation cards ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card transition hover:shadow-lift active:scale-[0.99]"
          >
            <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${item.tint}`}>
              <item.icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">{item.title}</p>
              <p className="truncate text-sm text-muted">{item.subtitle}</p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-muted transition group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      {/* ── Inline directory editors ── */}
      <div className="flex items-center gap-2 pt-1">
        <Store size={16} className="text-muted" />
        <Tag size={16} className="text-muted" />
        <h2 className="text-sm font-bold text-muted">Direktori Merchant & Kategori</h2>
      </div>

      <MerchantManager onStatus={setStatus} />
      <CategoryManager onStatus={setStatus} />
    </div>
  );
}
