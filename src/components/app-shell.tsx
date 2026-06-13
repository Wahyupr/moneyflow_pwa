"use client";

import Link from "next/link";
import {
  BarChart3,
  Bell,
  Eye,
  EyeOff,
  FileCheck2,
  Home,
  LockKeyhole,
  Mic,
  Plus,
  ReceiptText,
  ScanLine,
  Settings,
  TrendingUp,
  UserRound,
  WalletCards
} from "lucide-react";
import { useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { TransactionRow } from "@/components/transaction-row";
import { UploadPanel } from "@/components/upload-panel";
import { WalletCard } from "@/components/wallet-card";
import { budgets, dashboardModel } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/money";

const quickActions = [
  { label: "Catat", icon: Plus, tone: "bg-primary text-white" },
  { label: "Suara", icon: Mic, tone: "bg-surface-container text-primary" },
  { label: "Struk", icon: ScanLine, tone: "bg-surface-container text-primary" }
];

const sideNav = [
  { label: "Home", icon: Home, href: "/dashboard", active: true },
  { label: "History", icon: ReceiptText, href: "/dashboard", active: false },
  { label: "Voice", icon: Mic, href: "/dashboard", active: false },
  { label: "Reports", icon: BarChart3, href: "/dashboard", active: false },
  { label: "Wallets", icon: WalletCards, href: "/wallets", active: false }
];

export function AppShell() {
  const [hidden, setHidden] = useState(dashboardModel.privacy.enabled);

  return (
    <div className="min-h-dvh bg-background text-ink md:flex">
      <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-surface-container bg-surface px-4 py-6 md:sticky md:top-0 md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <img src="/brand-mark.svg" alt="MoneyFlow" className="size-10 rounded-lg" />
          <div>
            <h1 className="text-xl font-bold text-primary">MoneyFlow</h1>
            <p className="text-xs text-muted">Modern Urban Finance</p>
          </div>
        </div>
        <nav className="flex-1 space-y-2">
          {sideNav.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                className={`flex min-h-12 w-full items-center gap-4 rounded-lg px-4 text-sm font-semibold transition active:scale-[0.98] ${
                  item.active ? "bg-primary-container text-white" : "text-muted hover:bg-surface-low"
                }`}
                href={item.href}
                key={item.label}
              >
                <Icon aria-hidden="true" size={19} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-surface-container pt-4">
          <button className="flex min-h-12 w-full items-center justify-between rounded-lg px-3 text-sm text-muted hover:bg-surface-low" type="button">
            <span className="flex items-center gap-3">
              <UserRound aria-hidden="true" size={18} />
              Nara
            </span>
            <Settings aria-hidden="true" size={18} />
          </button>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-3xl px-5 pb-28 pt-[max(env(safe-area-inset-top),1rem)] md:px-8 md:pb-10">
        <header className="sticky top-0 z-40 -mx-5 mb-4 flex items-center justify-between bg-background/95 px-5 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0">
          <div className="flex items-center gap-3">
            <img src="/brand-mark.svg" alt="MoneyFlow" className="size-10 rounded-lg md:hidden" />
            <div>
              <p className="text-sm text-muted">Hai, Nara</p>
              <h1 className="text-xl font-bold text-primary">MoneyFlow</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex size-11 items-center justify-center rounded-full bg-surface text-primary shadow-card active:scale-95" type="button" aria-label="Notifications">
              <Bell size={19} />
            </button>
            <button
              aria-label={hidden ? "Show nominal" : "Hide nominal"}
              className="flex size-11 items-center justify-center rounded-full bg-surface text-primary shadow-card active:scale-95"
              onClick={() => setHidden((value) => !value)}
              type="button"
            >
              {hidden ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-xl bg-surface p-6 shadow-card">
          <div className="absolute -right-12 -top-12 size-36 rounded-full bg-primary/10 blur-xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Saldo Total</p>
              <p className="mt-2 text-[36px] font-bold leading-[44px] tracking-[-0.02em] text-ink tabular-nums">
                {hidden ? "*********" : formatCurrency(dashboardModel.total_balance_minor, "IDR")}
              </p>
              <p className="mt-3 text-sm text-muted">
                {hidden
                  ? "****** pemasukan bulan ini"
                  : `${formatCurrency(dashboardModel.monthly.totals.income_minor, "IDR")} pemasukan bulan ini`}
              </p>
            </div>
            <TrendingUp aria-hidden="true" className="relative text-income" size={26} />
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-xl font-bold text-ink">{dashboardModel.insight.title}</h2>
          <p className="mt-2 text-sm leading-5 text-warning">{dashboardModel.insight.message}</p>
        </section>

        {dashboardModel.ai_review_queue.length > 0 ? (
          <section className="mt-5 rounded-xl border border-dashed border-warning bg-[#fff7e6] p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
                <FileCheck2 aria-hidden="true" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-ink">AI review needed</h2>
                  <span className="rounded-full bg-warning px-2 py-1 text-xs font-bold text-white">Draft</span>
                </div>
                <p className="mt-1 text-sm text-[#6f4b00]">
                  {dashboardModel.ai_review_queue[0].draft.merchant_name} perlu konfirmasi sebelum masuk ledger.
                </p>
                <button className="mt-3 min-h-11 rounded-lg bg-secondary px-4 text-sm font-bold text-white active:scale-[0.98]" type="button">
                  Confirm draft
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid grid-cols-3 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;

            return (
              <button className={`min-h-16 rounded-lg text-xs font-semibold shadow-card active:scale-[0.98] ${action.tone}`} key={action.label} type="button">
                <Icon aria-hidden="true" className="mx-auto mb-1" size={20} />
                {action.label}
              </button>
            );
          })}
        </section>

        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-ink">Dompet Saya</h2>
            <button className="min-h-11 rounded-lg px-3 text-sm font-bold text-primary active:bg-surface-container" type="button">
              Lihat Semua
            </button>
          </div>
          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {dashboardModel.wallets.map((wallet) => (
              <WalletCard hidden={hidden} key={wallet.id} wallet={wallet} />
            ))}
          </div>
        </section>

        <div className="mt-6">
          <UploadPanel />
        </div>

        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-ink">Transaksi terbaru</h2>
            <button className="min-h-11 rounded-lg px-3 text-sm font-bold text-primary active:bg-surface-container" type="button">
              Lihat
            </button>
          </div>
          <div className="space-y-3">
            {dashboardModel.recent_transactions.slice(0, 3).map((transaction) => (
              <TransactionRow hidden={hidden} key={transaction.id} transaction={transaction} />
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-xl bg-surface p-4 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-ink">Budget bulan ini</h2>
            <p className="text-sm font-bold text-primary">
              {hidden ? "****" : formatCurrency(dashboardModel.monthly.totals.net_minor, "IDR")}
            </p>
          </div>
          <div className="space-y-4">
            {budgets.map((budget) => {
              const progress = Math.min(100, Math.round((budget.used_minor / budget.limit_minor) * 100));

              return (
                <div key={budget.id}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{budget.name}</span>
                    <span className="font-semibold text-muted">
                      {hidden ? "**%" : `${progress}%`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container">
                    <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: budget.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-xl bg-surface p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-surface-container text-primary">
              <LockKeyhole aria-hidden="true" size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-ink">Privacy Mode</h2>
              <p className="text-sm text-muted">Nominal berubah menjadi asterisk saat aktif.</p>
            </div>
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
