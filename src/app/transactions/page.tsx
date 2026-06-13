"use client";

import { Search, WalletCards } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { usePrivacy } from "@/components/privacy-provider";
import { dashboardModel } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/money";

const filters = ["Semua", "Pemasukan", "Pengeluaran", "Transfer"];

export default function TransactionsPage() {
  return (
    <AppFrame title="MoneyFlow">
      <TransactionsContent />
    </AppFrame>
  );
}

function TransactionsContent() {
  const { displayAmount } = usePrivacy();
  const today = dashboardModel.recent_transactions.slice(0, 2);
  const yesterday = dashboardModel.recent_transactions.slice(2, 5);

  return (
    <div className="mt-5">
      <h2 className="text-xl font-bold text-ink">Riwayat Transaksi</h2>
      <div className="mt-3 flex min-h-14 items-center gap-3 rounded-xl bg-surface px-4 shadow-card">
        <Search className="text-muted" size={20} />
        <input className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-muted focus:ring-0" placeholder="Cari transaksi..." />
      </div>
      <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((filter, index) => (
          <button
            className={`min-h-10 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${
              index === 0 ? "border-primary bg-primary text-white" : "border-outline bg-surface text-muted"
            }`}
            key={filter}
            type="button"
          >
            {filter}
          </button>
        ))}
      </div>
      <TransactionGroup label="HARI INI" rows={today} displayAmount={displayAmount} />
      <TransactionGroup label="KEMARIN" rows={yesterday} displayAmount={displayAmount} />
      <section className="mt-3 rounded-xl border-2 border-dashed border-warning bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-surface-container text-warning">
              <WalletCards size={18} />
            </div>
            <div>
              <p className="font-bold text-ink">Tokopedia</p>
              <p className="text-sm text-warning">Butuh Konfirmasi · 12:10</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-ink">{displayAmount("-Rp 125.000")}</p>
            <button className="mt-2 rounded-lg bg-warning px-3 py-1 text-xs font-bold text-white" type="button">
              Cek
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function TransactionGroup({
  label,
  rows,
  displayAmount
}: {
  label: string;
  rows: typeof dashboardModel.recent_transactions;
  displayAmount: (value: string) => string;
}) {
  return (
    <section className="mt-5">
      <h3 className="mb-3 text-sm font-bold text-muted">{label}</h3>
      <div className="space-y-3">
        {rows.map((transaction) => {
          const amount = `${transaction.transaction_type === "income" ? "+" : "-"}${formatCurrency(transaction.amount_minor, transaction.currency)}`;
          const positive = transaction.transaction_type === "income";

          return (
            <article className="flex items-center justify-between gap-3 rounded-xl bg-surface p-4 shadow-card" key={transaction.id}>
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${positive ? "bg-income/10 text-income" : "bg-error-container text-expense"}`}>
                  <WalletCards size={18} />
                </div>
                <div className="min-w-0">
                  <h4 className="truncate font-bold text-ink">{transaction.merchant_name}</h4>
                  <p className="truncate text-sm text-muted">{transaction.payment_method} · {new Date(transaction.occurred_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
              <p className={`shrink-0 text-right font-bold ${positive ? "text-income" : "text-ink"}`}>{displayAmount(amount)}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
