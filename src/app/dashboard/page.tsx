"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Eye, EyeOff, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { DailyInsightCard } from "@/components/daily-insight-card";
import { usePrivacy } from "@/components/privacy-provider";
import { TransactionRow } from "@/components/transaction-row";
import { WalletCard } from "@/components/wallet-card";
import { formatCurrency } from "@/lib/money";
import type { DashboardBudget, DashboardDelta, DashboardWallet } from "@/lib/dashboard";
import type { LedgerTransaction } from "@/lib/types";

type DashboardViewModel = {
  total_balance_minor: number;
  wallets: DashboardWallet[];
  budgets: DashboardBudget[];
  income_delta: DashboardDelta;
  expense_delta: DashboardDelta;
  recent_transactions: LedgerTransaction[];
  monthly: { totals: { income_minor: number; expense_minor: number; net_minor: number } };
  insight: { title: string; message: string };
};

function timeGreeting(hour: number): string {
  if (hour >= 5 && hour < 11) {
    return "Selamat pagi";
  }
  if (hour >= 11 && hour < 15) {
    return "Selamat siang";
  }
  if (hour >= 15 && hour < 18) {
    return "Selamat sore";
  }
  return "Selamat malam";
}

export default function DashboardPage() {
  const [fullName, setFullName] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("Selamat datang");

  useEffect(() => {
    setGreeting(timeGreeting(new Date().getHours()));
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Gagal memuat profil.");
        }
        return response.json();
      })
      .then((json) => {
        if (active) {
          const name = json?.profile?.display_name as string | undefined;
          setFullName(name && name.trim().length > 0 ? name : null);
        }
      })
      .catch(() => {
        // Keep the default greeting when the profile cannot be loaded.
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppFrame title={greeting} subtitle={fullName ? `Hai! ${fullName}` : "Hai!"}>
      <DashboardContent />
    </AppFrame>
  );
}


function DeltaBadge({ delta }: { delta: DashboardDelta }) {
  const tone = delta.positive ? "bg-income/10 text-income" : "bg-expense/10 text-expense";
  const sign = delta.percent > 0 ? "+" : "";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>
      {sign}
      {delta.percent}%
    </span>
  );
}

function DashboardContent() {
  const { hidden, toggleHidden, displayAmount } = usePrivacy();
  const [dashboard, setDashboard] = useState<DashboardViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch("/api/dashboard")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Gagal memuat dashboard.");
        }
        return response.json();
      })
      .then((json) => {
        if (active) {
          setDashboard(json.dashboard as DashboardViewModel);
        }
      })
      .catch(() => {
        if (active) {
          setError("Tidak bisa memuat data dashboard.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !dashboard) {
    return (
      <div className="mt-6 rounded-xl bg-surface p-5 text-center shadow-card">
        <p className="font-bold text-ink">Gagal memuat data</p>
        <p className="mt-2 text-sm text-muted">{error ?? "Coba muat ulang halaman."}</p>
      </div>
    );
  }

  return (
    <>
      <section className="relative mt-3 overflow-hidden rounded-xl bg-surface p-5 shadow-card">
        <div className="absolute -right-12 -top-12 size-36 rounded-full bg-primary/10 blur-xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted">Saldo Total</p>
              <button
                aria-label={hidden ? "Tampilkan nominal" : "Sembunyikan nominal"}
                className="flex size-7 items-center justify-center rounded-full bg-surface-container text-primary active:scale-95"
                onClick={toggleHidden}
                type="button"
              >
                {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="mt-2 text-[32px] font-bold leading-10 tracking-[-0.02em] text-ink tabular-nums md:text-[36px] md:leading-[44px]">
              {displayAmount(formatCurrency(dashboard.total_balance_minor, "IDR"))}
            </p>
          </div>
          <TrendingUp aria-hidden="true" className="relative text-income" size={26} />
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-surface-container px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <ArrowDownRight aria-hidden="true" className="text-income" size={14} />
              Income
              <DeltaBadge delta={dashboard.income_delta} />
            </div>
            <p className="mt-1 text-sm font-bold text-ink tabular-nums">
              {displayAmount(formatCurrency(dashboard.monthly.totals.income_minor, "IDR"))}
            </p>
          </div>
          <div className="rounded-lg bg-surface-container px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <ArrowUpRight aria-hidden="true" className="text-expense" size={14} />
              Expense
              <DeltaBadge delta={dashboard.expense_delta} />
            </div>
            <p className="mt-1 text-sm font-bold text-ink tabular-nums">
              {displayAmount(formatCurrency(dashboard.monthly.totals.expense_minor, "IDR"))}
            </p>
          </div>
        </div>
      </section>

      <DailyInsightCard />

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Dompet Saya</h2>
          <Link className="min-h-10 rounded-lg px-3 py-2 text-sm font-bold text-primary active:bg-surface-container" href="/wallets">
            Lihat Semua
          </Link>
        </div>
        {dashboard.wallets.length > 0 ? (
          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {dashboard.wallets.map((wallet) => (
              <WalletCard compact hidden={hidden} key={wallet.id} wallet={wallet} />
            ))}
          </div>
        ) : (
          <EmptyState message="Belum ada dompet. Tambahkan dompet pertama kamu." href="/wallets" cta="Tambah Dompet" />
        )}
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Transaksi terbaru</h2>
          <Link className="min-h-10 rounded-lg px-3 py-2 text-sm font-bold text-primary active:bg-surface-container" href="/transactions">
            Lihat
          </Link>
        </div>
        {dashboard.recent_transactions.length > 0 ? (
          <div className="space-y-3">
            {dashboard.recent_transactions.slice(0, 3).map((transaction) => (
              <TransactionRow hidden={hidden} key={transaction.id} transaction={transaction} />
            ))}
          </div>
        ) : (
          <EmptyState message="Belum ada transaksi bulan ini." href="/transactions/new" cta="Catat Transaksi" />
        )}
      </section>

      {dashboard.budgets.length > 0 ? (
        <section className="mt-6 rounded-xl bg-surface p-4 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">Budget bulan ini</h2>
            <p className="text-sm font-bold text-primary">{displayAmount(formatCurrency(dashboard.monthly.totals.net_minor, "IDR"))}</p>
          </div>
          <div className="space-y-4">
            {dashboard.budgets.map((budget) => {
              const progress = Math.min(100, Math.round((budget.used_minor / Math.max(budget.limit_minor, 1)) * 100));

              return (
                <div key={budget.id}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{budget.name}</span>
                    <span className="font-semibold text-muted">{hidden ? "**%" : `${progress}%`}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container">
                    <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: budget.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}

function EmptyState({ message, href, cta }: { message: string; href: string; cta: string }) {
  return (
    <div className="rounded-xl bg-surface p-5 text-center shadow-card">
      <p className="text-sm text-muted">{message}</p>
      <Link className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-bold text-white active:scale-[0.98]" href={href}>
        {cta}
      </Link>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mt-3 space-y-4" aria-hidden="true">
      <div className="h-36 animate-pulse rounded-xl bg-surface-container" />
      <div className="h-10 animate-pulse rounded-lg bg-surface-container" />
      <div className="flex gap-3">
        <div className="h-28 w-40 animate-pulse rounded-xl bg-surface-container" />
        <div className="h-28 w-40 animate-pulse rounded-xl bg-surface-container" />
      </div>
      <div className="h-16 animate-pulse rounded-lg bg-surface-container" />
      <div className="h-16 animate-pulse rounded-lg bg-surface-container" />
    </div>
  );
}
