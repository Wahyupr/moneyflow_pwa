"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { usePrivacy } from "@/components/privacy-provider";
import { TransactionRow } from "@/components/transaction-row";
import { WalletCard } from "@/components/wallet-card";
import { budgets, dashboardModel } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/money";
import type { DashboardDelta } from "@/lib/dashboard";

export default function DashboardPage() {
  return (
    <AppFrame title="MoneyFlow" subtitle="Hai, Nara">
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
  const { hidden, displayAmount } = usePrivacy();

  return (
    <>
      <section className="relative mt-3 overflow-hidden rounded-xl bg-surface p-5 shadow-card">
        <div className="absolute -right-12 -top-12 size-36 rounded-full bg-primary/10 blur-xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted">Saldo Total</p>
              <span className="rounded-full bg-surface-container px-2 py-1 text-[11px] font-bold text-primary">Privacy</span>
            </div>
            <p className="mt-2 text-[32px] font-bold leading-10 tracking-[-0.02em] text-ink tabular-nums md:text-[36px] md:leading-[44px]">
              {displayAmount(formatCurrency(dashboardModel.total_balance_minor, "IDR"))}
            </p>
          </div>
          <TrendingUp aria-hidden="true" className="relative text-income" size={26} />
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-surface-container px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <ArrowDownRight aria-hidden="true" className="text-income" size={14} />
              Income
              <DeltaBadge delta={dashboardModel.income_delta} />
            </div>
            <p className="mt-1 text-sm font-bold text-ink tabular-nums">
              {displayAmount(formatCurrency(dashboardModel.monthly.totals.income_minor, "IDR"))}
            </p>
          </div>
          <div className="rounded-lg bg-surface-container px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <ArrowUpRight aria-hidden="true" className="text-expense" size={14} />
              Expense
              <DeltaBadge delta={dashboardModel.expense_delta} />
            </div>
            <p className="mt-1 text-sm font-bold text-ink tabular-nums">
              {displayAmount(formatCurrency(dashboardModel.monthly.totals.expense_minor, "IDR"))}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-4 flex items-center gap-2 rounded-lg bg-surface px-3 py-2 shadow-card">
        <span className="text-xs font-semibold text-muted">{dashboardModel.insight.title}</span>
        <span className="text-xs text-ink">{dashboardModel.insight.message}</span>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Dompet Saya</h2>
          <Link className="min-h-10 rounded-lg px-3 py-2 text-sm font-bold text-primary active:bg-surface-container" href="/wallets">
            Lihat Semua
          </Link>
        </div>
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dashboardModel.wallets.map((wallet) => (
            <WalletCard compact hidden={hidden} key={wallet.id} wallet={wallet} />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Transaksi terbaru</h2>
          <Link className="min-h-10 rounded-lg px-3 py-2 text-sm font-bold text-primary active:bg-surface-container" href="/transactions">
            Lihat
          </Link>
        </div>
        <div className="space-y-3">
          {dashboardModel.recent_transactions.slice(0, 3).map((transaction) => (
            <TransactionRow hidden={hidden} key={transaction.id} transaction={transaction} />
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-xl bg-surface p-4 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Budget bulan ini</h2>
          <p className="text-sm font-bold text-primary">{displayAmount(formatCurrency(dashboardModel.monthly.totals.net_minor, "IDR"))}</p>
        </div>
        <div className="space-y-4">
          {budgets.map((budget) => {
            const progress = Math.min(100, Math.round((budget.used_minor / budget.limit_minor) * 100));

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
    </>
  );
}
