"use client";

import { Search, WalletCards } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { usePrivacy } from "@/components/privacy-provider";
import { formatCurrency } from "@/lib/money";

type TransactionRow = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  merchant_name: string | null;
  payment_method: string | null;
  transaction_type: "expense" | "income";
  amount_minor: number;
  currency: string;
  occurred_at: string;
  note: string | null;
  transfer_pair_id: string | null;
  merchant_logo_url?: string | null;
  created_by_name?: string | null;
  wallet_name?: string | null;
};


const FILTERS = [
  { label: "Semua", value: "all" },
  { label: "Pemasukan", value: "income" },
  { label: "Pengeluaran", value: "expense" },
  { label: "Transfer", value: "transfer" }
] as const;

export default function TransactionsPage() {
  return (
    <AppFrame title="MoneyFlow">
      <TransactionsContent />
    </AppFrame>
  );
}

function TransactionsContent() {
  const { displayAmount } = usePrivacy();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/transactions", { cache: "no-store" });
      if (!response.ok) {
        setError("Gagal memuat transaksi.");
        return;
      }
      const payload = await response.json();
      setTransactions((payload.transactions ?? []) as TransactionRow[]);
    } catch {
      setError("Gagal memuat transaksi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    function handleVisibility() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (filter !== "all" && transaction.transaction_type !== filter) {
        return false;
      }
      if (term) {
        const haystack = `${transaction.merchant_name ?? ""} ${transaction.note ?? ""}`.toLowerCase();
        return haystack.includes(term);
      }
      return true;
    });
  }, [transactions, filter, search]);

  // Group transactions by calendar day for the section headers.
  const groups = useMemo(() => {
    const map = new Map<string, TransactionRow[]>();
    for (const transaction of filtered) {
      const key = transaction.occurred_at.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(transaction);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // Summary totals
  const totalIncome = useMemo(() => filtered.filter(t => t.transaction_type === "income").reduce((sum, t) => sum + t.amount_minor, 0), [filtered]);
  const totalExpense = useMemo(() => filtered.filter(t => t.transaction_type === "expense").reduce((sum, t) => sum + t.amount_minor, 0), [filtered]);

  return (
    <div className="mt-5 lg:grid lg:grid-cols-[1fr_300px] lg:items-start lg:gap-6">
      {/* ── Main list ── */}
      <div>
        <h2 className="text-xl font-bold text-ink lg:hidden">Riwayat Transaksi</h2>
        <div className="mt-3 flex min-h-14 items-center gap-3 rounded-xl bg-surface px-4 shadow-card lg:mt-0">
          <Search className="text-muted" size={20} />
          <input
            className="w-full border-0 bg-transparent text-base outline-none placeholder:text-muted focus:ring-0"
            placeholder="Cari transaksi..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0">
          {FILTERS.map((item) => (
            <button
              className={`min-h-10 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${
                filter === item.value ? "border-primary bg-primary text-white" : "border-outline bg-surface text-muted"
              }`}
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="mt-5 rounded-xl bg-surface p-5 text-center text-sm text-muted shadow-card">Memuat transaksi...</p>
        ) : error ? (
          <div className="mt-5 rounded-xl bg-surface p-5 text-center shadow-card">
            <p className="text-sm font-semibold text-error">{error}</p>
            <button className="mt-3 min-h-10 rounded-lg bg-surface-container px-4 text-sm font-bold text-primary active:scale-[0.98]" onClick={() => void load()} type="button">
              Coba lagi
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="mt-5 rounded-xl bg-surface p-6 text-center shadow-card">
            <p className="font-semibold text-ink">Belum ada transaksi</p>
            <p className="mt-1 text-sm text-muted">Catat transaksi pertama Anda untuk melihat riwayat di sini.</p>
          </div>
        ) : (
          groups.map(([day, rows]) => (
            <TransactionGroup key={day} label={formatDayLabel(day)} rows={rows} displayAmount={displayAmount} />
          ))
        )}
      </div>

      {/* ── Desktop right sidebar ── */}
      <aside className="hidden lg:sticky lg:top-[57px] lg:flex lg:flex-col lg:gap-4 lg:self-start">
        {/* Summary card */}
        <div className="rounded-xl bg-surface p-4 shadow-card">
          <h3 className="mb-3 text-sm font-bold text-muted uppercase tracking-wide">Ringkasan</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Total Transaksi</span>
              <span className="font-bold text-ink">{filtered.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Pemasukan</span>
              <span className="font-bold text-income">{displayAmount(formatCurrency(totalIncome, "IDR"))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Pengeluaran</span>
              <span className="font-bold text-expense">{displayAmount(formatCurrency(totalExpense, "IDR"))}</span>
            </div>
            <div className="border-t border-outline pt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-muted">Selisih</span>
              <span className={`font-bold ${totalIncome - totalExpense >= 0 ? "text-income" : "text-expense"}`}>
                {displayAmount(formatCurrency(totalIncome - totalExpense, "IDR"))}
              </span>
            </div>
          </div>
        </div>

        {/* Filter info */}
        <div className="rounded-xl bg-surface p-4 shadow-card">
          <h3 className="mb-3 text-sm font-bold text-muted uppercase tracking-wide">Filter Aktif</h3>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  filter === item.value ? "border-primary bg-primary text-white" : "border-outline bg-surface-container text-muted hover:border-primary/50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function TransactionGroup({
  label,
  rows,
  displayAmount
}: {
  label: string;
  rows: TransactionRow[];
  displayAmount: (value: string) => string;
}) {
  return (
    <section className="mt-5">
      <h3 className="mb-3 text-sm font-bold text-muted">{label}</h3>
      <div className="space-y-3">
        {rows.map((transaction) => {
          const positive = transaction.transaction_type === "income";
          const sign = positive ? "+" : transaction.transaction_type === "expense" ? "-" : "";
          const amount = `${sign}${formatCurrency(transaction.amount_minor, "IDR")}`;

          const time = new Date(transaction.occurred_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
          const subtitleParts = [time, transaction.note].filter(Boolean);
          const metaParts: string[] = [];
          if (transaction.wallet_name) metaParts.push(transaction.wallet_name);
          if (transaction.created_by_name) metaParts.push(`oleh ${transaction.created_by_name}`);

          return (
            <Link
              href={`/transactions/${transaction.id}`}
              key={transaction.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface p-4 shadow-card transition active:scale-[0.99]"
            >
              <div className="flex min-w-0 items-center gap-3">
                {transaction.merchant_logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={transaction.merchant_name ?? "Merchant"} className="size-11 shrink-0 rounded-full object-cover" src={transaction.merchant_logo_url} />
                ) : (
                  <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${positive ? "bg-income/10 text-income" : "bg-error-container text-expense"}`}>
                    <WalletCards size={18} />
                  </div>
                )}

                <div className="min-w-0">
                  <h4 className="truncate font-bold text-ink">{transaction.merchant_name ?? "Transaksi"}</h4>
                  <p className="truncate text-sm text-muted">{subtitleParts.join(" · ")}</p>
                  {metaParts.length > 0 ? (
                    <p className="truncate text-xs text-muted/70">{metaParts.join(" · ")}</p>
                  ) : null}
                </div>
              </div>
              <p className={`shrink-0 text-right font-bold ${positive ? "text-income" : "text-ink"}`}>{displayAmount(amount)}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function formatDayLabel(day: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (day === today) {
    return "HARI INI";
  }
  if (day === yesterday) {
    return "KEMARIN";
  }
  return new Date(`${day}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
}
