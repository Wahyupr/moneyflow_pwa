"use client";

import { Calendar, CalendarClock, ChevronDown, ChevronUp, CreditCard, Info, Trash2, WalletCards, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { SelectMenu } from "@/components/ui/select-menu";
import { DEBT_CATEGORIES } from "@/lib/entitlements";
import { formatCurrency } from "@/lib/money";

export type Debt = {
  id: string;
  name: string;
  creditor_name: string;
  category: string;
  total_amount_minor: number;
  paid_amount_minor: number;
  remaining_amount_minor: number;
  monthly_installment_minor: number | null;
  installment_months: number | null;
  interest_rate_per_month_bps: number | null;
  total_interest_minor: number | null;
  total_with_interest_minor: number | null;
  interest_rate_total_pct: number | null;
  remaining_with_interest_minor: number | null;
  next_due_date: string | null;
  target_paid_off_date: string | null;
  notes: string | null;
  status: string;
};

export function calcFlatMonthly(principal: number, months: number, bpsPerMonth: number): number {
  const rate = bpsPerMonth / 10000;
  const totalInterest = principal * rate * months;
  return Math.ceil((principal + totalInterest) / months);
}

const CATEGORY_OPTIONS = [
  ...DEBT_CATEGORIES.map((value) => ({ value, label: value })),
  { value: "__custom__", label: "Lainnya (ketik sendiri)" },
];

const TENOR_OPTIONS = [
  { label: "1 bln", value: 1 },
  { label: "6 bln", value: 6 },
  { label: "12 bln", value: 12 },
  { label: "Custom", value: 0 },
];

// ─── DebtCard ───────────────────────────────────────────────────────────────

export function DebtCard({
  debt,
  busy,
  onPay,
  onDelete,
  displayAmount,
}: {
  debt: Debt;
  busy: boolean;
  onPay: () => void;
  onDelete: () => void;
  displayAmount: (v: string) => string;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const progressPct =
    debt.total_amount_minor > 0
      ? Math.min(100, Math.round((debt.paid_amount_minor / debt.total_amount_minor) * 100))
      : 0;
  const dueDate = debt.next_due_date
    ? new Date(debt.next_due_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const targetDate = debt.target_paid_off_date
    ? new Date(debt.target_paid_off_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const initial = debt.creditor_name.trim().charAt(0).toUpperCase() || "?";

  // Derived interest data (from API or compute locally as fallback)
  const totalInterest = debt.total_interest_minor ?? 0;
  const totalWithInterest = debt.total_with_interest_minor;
  const interestPctTotal = debt.interest_rate_total_pct;
  const interestPctPerMonth =
    debt.installment_months && debt.installment_months > 0 && interestPctTotal != null
      ? interestPctTotal / debt.installment_months
      : null;
  const remainingWithInterest = debt.remaining_with_interest_minor;
  const hasInstallmentData =
    debt.installment_months != null && debt.monthly_installment_minor != null;

  return (
    <article className="rounded-xl bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-bold text-ink">{debt.name}</h4>
          <p className="truncate text-xs text-muted">
            {debt.creditor_name} · {debt.category}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="text-muted transition hover:text-expense disabled:opacity-50"
          aria-label="Hapus"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Total Pinjaman</p>
          <p className="text-sm font-bold text-ink">
            {displayAmount(formatCurrency(debt.total_amount_minor, "IDR"))}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Sisa Hutang Pokok</p>
          <p className="text-sm font-bold text-expense">
            {displayAmount(formatCurrency(debt.remaining_amount_minor, "IDR"))}
          </p>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
        <div className="h-full rounded-full bg-tertiary" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted">
        {displayAmount(formatCurrency(debt.paid_amount_minor, "IDR"))} terbayar · {progressPct}%
      </p>

      {debt.monthly_installment_minor ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted">
          <CreditCard aria-hidden="true" size={12} />
          Cicilan {displayAmount(formatCurrency(debt.monthly_installment_minor, "IDR"))}/bln
          {debt.installment_months ? ` · ${debt.installment_months} bulan` : ""}
        </p>
      ) : null}

      {dueDate ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <Calendar aria-hidden="true" size={12} />
          Jatuh tempo berikutnya {dueDate}
        </p>
      ) : null}

      {targetDate ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <CalendarClock aria-hidden="true" size={12} />
          Target lunas {targetDate}
        </p>
      ) : null}

      {hasInstallmentData ? (
        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          className="mt-2 flex w-full items-center justify-between rounded-lg bg-surface-container px-3 py-2 text-xs font-semibold text-ink"
        >
          <span className="flex items-center gap-1">
            <Info size={12} className="text-primary" />
            Rincian Cicilan &amp; Bunga
          </span>
          {showBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      ) : null}

      {showBreakdown && hasInstallmentData ? (
        <div className="mt-2 rounded-lg bg-surface-container px-3 py-2 text-xs space-y-1">
          <Row label="Hutang Pokok" value={displayAmount(formatCurrency(debt.total_amount_minor, "IDR"))} />
          <Row label={`Total Bunga (${(interestPctTotal ?? 0).toFixed(2)}%)`} value={displayAmount(formatCurrency(totalInterest, "IDR"))} highlight />
          {interestPctPerMonth != null ? (
            <Row label="Bunga / Bulan" value={`${interestPctPerMonth.toFixed(2)}%`} />
          ) : null}
          {totalWithInterest != null ? (
            <Row label="Total Bayar (pokok + bunga)" value={displayAmount(formatCurrency(totalWithInterest, "IDR"))} bold />
          ) : null}
          <div className="border-t border-outline pt-1 mt-1">
            <Row label="Sisa Hutang Pokok" value={displayAmount(formatCurrency(debt.remaining_amount_minor, "IDR"))} />
            {remainingWithInterest != null ? (
              <Row label="Sisa Hutang + Bunga" value={displayAmount(formatCurrency(remainingWithInterest, "IDR"))} bold />
            ) : null}
          </div>
        </div>
      ) : null}

      {debt.remaining_amount_minor > 0 ? (
        <button
          type="button"
          onClick={onPay}
          disabled={busy}
          className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-60"
        >
          <WalletCards size={16} />
          Catat Pembayaran
        </button>
      ) : (
        <p className="mt-3 rounded-lg bg-income/10 p-2 text-center text-xs font-semibold text-income">
          Lunas
        </p>
      )}
    </article>
  );
}

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={bold ? "font-bold text-ink" : highlight ? "font-semibold text-warning" : "font-semibold text-ink"}>
        {value}
      </span>
    </div>
  );
}
