"use client";

import { ArrowDownRight, ArrowUpRight, PieChart } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { usePrivacy } from "@/components/privacy-provider";
import { budgets, dashboardModel } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/money";

export default function ReportsPage() {
  return (
    <AppFrame title="Reports" subtitle="Analytics">
      <ReportsContent />
    </AppFrame>
  );
}

function ReportsContent() {
  const { displayAmount } = usePrivacy();
  const { totals } = dashboardModel.monthly;

  return (
    <div className="mt-5 space-y-5">
      <section className="grid grid-cols-2 gap-3">
        <Metric title="Pemasukan" value={displayAmount(formatCurrency(totals.income_minor, "IDR"))} tone="income" icon={ArrowUpRight} />
        <Metric title="Pengeluaran" value={displayAmount(formatCurrency(totals.expense_minor, "IDR"))} tone="expense" icon={ArrowDownRight} />
      </section>
      <section className="rounded-xl bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Kategori</h2>
          <PieChart className="text-primary" size={22} />
        </div>
        <div className="mt-5 space-y-4">
          {budgets.map((budget) => {
            const progress = Math.min(100, Math.round((budget.used_minor / budget.limit_minor) * 100));

            return (
              <div key={budget.id}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold">{budget.name}</span>
                  <span className="text-muted">{progress}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-surface-container">
                  <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: budget.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="rounded-xl bg-surface p-5 shadow-card">
        <h2 className="text-lg font-bold text-ink">Insight Bulanan</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Pengeluaran hiburan naik 12%. Budget makan masih aman sampai akhir bulan.</p>
      </section>
    </div>
  );
}

function Metric({ title, value, tone, icon: Icon }: { title: string; value: string; tone: "income" | "expense"; icon: typeof ArrowUpRight }) {
  return (
    <article className="rounded-xl bg-surface p-4 shadow-card">
      <div className={`mb-3 flex size-10 items-center justify-center rounded-full ${tone === "income" ? "bg-income/10 text-income" : "bg-error-container text-expense"}`}>
        <Icon size={20} />
      </div>
      <p className="text-sm text-muted">{title}</p>
      <p className={`mt-1 break-words text-base font-bold ${tone === "income" ? "text-income" : "text-expense"}`}>{value}</p>
    </article>
  );
}
