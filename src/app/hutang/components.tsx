"use client";

import { AlertTriangle, Calendar, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Clock, CreditCard, Info, Pencil, Trash2, WalletCards, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { SelectMenu } from "@/components/ui/select-menu";
import { DEBT_CATEGORIES } from "@/lib/entitlements";
import { formatCurrency, formatThousands, parseThousands } from "@/lib/money";

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

/** Hitung selisih hari dari sekarang ke tanggal target. Negatif = sudah lewat. */
function daysDiff(isoDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function DueDateBadge({ isoDate, label }: { isoDate: string; label: string }) {
  const diff = daysDiff(isoDate);
  const formatted = new Date(isoDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  let badge = "";
  let badgeColor = "text-muted";
  if (diff < 0) {
    badge = `${Math.abs(diff)} hari lalu`;
    badgeColor = "text-expense font-semibold";
  } else if (diff === 0) {
    badge = "Hari ini";
    badgeColor = "text-expense font-semibold";
  } else if (diff <= 7) {
    badge = `${diff} hari lagi`;
    badgeColor = "text-amber-600 dark:text-amber-400 font-semibold";
  } else {
    badge = `${diff} hari lagi`;
  }

  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-muted">
      <Calendar aria-hidden="true" size={12} className="shrink-0" />
      {label} <span className="font-medium text-ink">{formatted}</span>
      <span className={`ml-0.5 ${badgeColor}`}>· {badge}</span>
    </p>
  );
}

// ─── Status badge helper ─────────────────────────────────────────────────────

function DebtStatusBadge({ debt }: { debt: Debt }) {
  const isLunas = debt.remaining_amount_minor <= 0 || debt.status === "paid_off";

  if (isLunas) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-income/10 px-2 py-0.5 text-[10px] font-bold text-income">
        <CheckCircle2 size={10} />
        LUNAS
      </span>
    );
  }

  if (debt.next_due_date) {
    const diff = daysDiff(debt.next_due_date);
    if (diff < 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-expense/10 px-2 py-0.5 text-[10px] font-bold text-expense">
          <AlertTriangle size={10} />
          JATUH TEMPO
        </span>
      );
    }
    if (diff <= 7) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <Clock size={10} />
          {diff === 0 ? "HARI INI" : `${diff}H LAGI`}
        </span>
      );
    }
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
      AKTIF
    </span>
  );
}

// ─── DebtCard ───────────────────────────────────────────────────────────────

export function DebtCard({
  debt,
  busy,
  onPay,
  onDelete,
  onEdit,
  displayAmount,
}: {
  debt: Debt;
  busy: boolean;
  onPay: () => void;
  onDelete: () => void;
  onEdit: () => void;
  displayAmount: (v: string) => string;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const isLunas = debt.remaining_amount_minor <= 0 || debt.status === "paid_off";

  const progressPct =
    debt.total_amount_minor > 0
      ? Math.min(100, Math.round((debt.paid_amount_minor / debt.total_amount_minor) * 100))
      : 0;

  const initial = debt.creditor_name.trim().charAt(0).toUpperCase() || "?";

  // Derived interest data
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

  const monthsRemaining = useMemo(() => {
    if (!debt.monthly_installment_minor || debt.monthly_installment_minor <= 0) return null;
    if (debt.remaining_amount_minor <= 0) return 0;
    return Math.ceil(debt.remaining_amount_minor / debt.monthly_installment_minor);
  }, [debt.remaining_amount_minor, debt.monthly_installment_minor]);

  // Border accent based on urgency
  const isOverdue = debt.next_due_date && daysDiff(debt.next_due_date) < 0 && !isLunas;
  const isDueSoon = debt.next_due_date && daysDiff(debt.next_due_date) <= 7 && daysDiff(debt.next_due_date) >= 0 && !isLunas;
  const cardBorder = isOverdue
    ? "border border-expense/40"
    : isDueSoon
      ? "border border-amber-400/50"
      : "";

  return (
    <article className={`rounded-xl bg-surface p-4 shadow-card ${cardBorder}`}>
      {/* Header: avatar + name + status badge + actions */}
      <div className="flex items-start gap-3">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full font-bold ${isLunas ? "bg-income/10 text-income" : "bg-primary/10 text-primary"}`}>
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate font-bold text-ink">{debt.name}</h4>
            <DebtStatusBadge debt={debt} />
          </div>
          <p className="truncate text-xs text-muted">
            {debt.creditor_name} · {debt.category}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-container hover:text-primary disabled:opacity-50"
            aria-label="Edit hutang"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-container hover:text-expense disabled:opacity-50"
            aria-label="Hapus"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Amount grid — 3 cols when has installment info */}
      <div className={`mt-3 grid gap-3 ${debt.monthly_installment_minor ? "grid-cols-3" : "grid-cols-2"}`}>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted">Total Pinjaman</p>
          <p className="text-sm font-bold text-ink">
            {displayAmount(formatCurrency(debt.total_amount_minor, "IDR"))}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted">Sudah Bayar</p>
          <p className="text-sm font-bold text-income">
            {displayAmount(formatCurrency(debt.paid_amount_minor, "IDR"))}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted">Sisa</p>
          <p className={`text-sm font-bold ${isLunas ? "text-income" : "text-expense"}`}>
            {displayAmount(formatCurrency(debt.remaining_amount_minor, "IDR"))}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Progress Pelunasan</p>
          <p className="text-[10px] font-bold text-ink">{progressPct}%</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
          <div
            className={`h-full rounded-full transition-all ${progressPct >= 100 ? "bg-income" : progressPct >= 75 ? "bg-tertiary" : "bg-primary"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Installment + duration info */}
      {debt.monthly_installment_minor ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="flex items-center gap-1 text-xs text-muted">
            <CreditCard aria-hidden="true" size={12} />
            {displayAmount(formatCurrency(debt.monthly_installment_minor, "IDR"))}/bln
            {debt.installment_months ? ` · ${debt.installment_months} bln` : ""}
          </p>
          {monthsRemaining != null && monthsRemaining > 0 ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              <Clock size={9} />
              ~{monthsRemaining} bln lagi
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Due dates */}
      {debt.next_due_date ? (
        <DueDateBadge isoDate={debt.next_due_date} label="Jatuh tempo" />
      ) : null}

      {debt.target_paid_off_date ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <CalendarClock aria-hidden="true" size={12} className="shrink-0" />
          Target lunas{" "}
          <span className="font-medium text-ink">
            {new Date(debt.target_paid_off_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          {(() => {
            const diff = daysDiff(debt.target_paid_off_date);
            if (diff < 0) return <span className="ml-0.5 font-semibold text-expense">· {Math.abs(diff)} hari lalu</span>;
            if (diff === 0) return <span className="ml-0.5 font-semibold text-expense">· Hari ini</span>;
            return <span className="ml-0.5 text-muted">· {diff} hari lagi</span>;
          })()}
        </p>
      ) : null}

      {/* Notes snippet */}
      {debt.notes ? (
        <p className="mt-2 line-clamp-2 rounded-lg bg-surface-container px-3 py-1.5 text-xs text-muted">
          {debt.notes}
        </p>
      ) : null}

      {/* Breakdown toggle */}
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
        <div className="mt-2 space-y-1 rounded-lg bg-surface-container px-3 py-2 text-xs">
          <Row label="Hutang Pokok" value={displayAmount(formatCurrency(debt.total_amount_minor, "IDR"))} />
          <Row label={`Total Bunga (${(interestPctTotal ?? 0).toFixed(2)}%)`} value={displayAmount(formatCurrency(totalInterest, "IDR"))} highlight />
          {interestPctPerMonth != null ? (
            <Row label="Bunga / Bulan" value={`${interestPctPerMonth.toFixed(2)}%`} />
          ) : null}
          {totalWithInterest != null ? (
            <Row label="Total Bayar (pokok + bunga)" value={displayAmount(formatCurrency(totalWithInterest, "IDR"))} bold />
          ) : null}
          <div className="mt-1 border-t border-outline pt-1">
            <Row label="Sisa Hutang Pokok" value={displayAmount(formatCurrency(debt.remaining_amount_minor, "IDR"))} />
            {remainingWithInterest != null ? (
              <Row label="Sisa + Bunga" value={displayAmount(formatCurrency(remainingWithInterest, "IDR"))} bold />
            ) : null}
            {monthsRemaining != null && monthsRemaining > 0 ? (
              <Row label="Estimasi Sisa Waktu" value={`~${monthsRemaining} bulan`} />
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Action button */}
      {isLunas ? (
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-income/10 p-2">
          <CheckCircle2 size={14} className="text-income" />
          <p className="text-xs font-bold text-income">Hutang Lunas</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPay}
          disabled={busy}
          className={`mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-60 ${
            isOverdue ? "bg-expense" : "bg-primary"
          }`}
        >
          <WalletCards size={16} />
          {isOverdue ? "Bayar Sekarang" : "Catat Pembayaran"}
        </button>
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

// ─── EditDebtSheet ───────────────────────────────────────────────────────────

export function EditDebtSheet({
  debt,
  onClose,
  onSaved,
}: {
  debt: Debt;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(debt.name);
  const [creditorName, setCreditorName] = useState(debt.creditor_name);
  const [category, setCategory] = useState(
    DEBT_CATEGORIES.includes(debt.category as typeof DEBT_CATEGORIES[number]) ? debt.category : "__custom__"
  );
  const [customCategory, setCustomCategory] = useState(
    DEBT_CATEGORIES.includes(debt.category as typeof DEBT_CATEGORIES[number]) ? "" : debt.category
  );
  const [monthlyInstallment, setMonthlyInstallment] = useState(
    debt.monthly_installment_minor != null ? String(debt.monthly_installment_minor) : ""
  );
  // keep raw numeric string internally; display formatted
  const [nextDueDate, setNextDueDate] = useState(
    debt.next_due_date ? debt.next_due_date.slice(0, 10) : ""
  );
  const [targetDate, setTargetDate] = useState(
    debt.target_paid_off_date ? debt.target_paid_off_date.slice(0, 10) : ""
  );
  const [notes, setNotes] = useState(debt.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustom = category === "__custom__";
  const effectiveCategory = isCustom ? customCategory.trim() : category;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Nama hutang wajib diisi.");
    if (!creditorName.trim()) return setError("Nama kreditur wajib diisi.");
    if (!effectiveCategory) return setError("Kategori wajib dipilih.");

    const monthlyMinor = monthlyInstallment.trim()
      ? Math.round(Number(parseThousands(monthlyInstallment)) || 0)
      : null;

    setBusy(true);
    try {
      const res = await fetch(`/api/debts/${debt.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          creditor_name: creditorName.trim(),
          category: effectiveCategory,
          monthly_installment_minor: monthlyMinor,
          next_due_date: nextDueDate ? new Date(`${nextDueDate}T09:00:00.000Z`).toISOString() : null,
          target_paid_off_date: targetDate ? new Date(`${targetDate}T09:00:00.000Z`).toISOString() : null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Gagal menyimpan perubahan.");
        return;
      }
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4 lg:items-center lg:p-6"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={submit}
        className="flex w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-lift sm:rounded-2xl lg:max-w-lg"
        style={{ maxHeight: "min(92dvh, calc(100dvh - env(safe-area-inset-bottom, 0px)))" }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
          <h3 className="text-lg font-bold text-ink">Edit Hutang</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-container"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-semibold text-muted">Nama / Jenis Hutang</span>
              <input
                className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="KPR Rumah"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted">Kreditur</span>
              <input
                className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
                value={creditorName}
                onChange={(e) => setCreditorName(e.target.value)}
                placeholder="Bank / Orang yang dituju"
              />
            </label>

            <div className="block">
              <span className="text-sm font-semibold text-muted">Kategori</span>
              <SelectMenu
                ariaLabel="Kategori hutang"
                value={category}
                onChange={setCategory}
                placeholder="Pilih kategori"
                options={CATEGORY_OPTIONS}
              />
            </div>

            {isCustom ? (
              <label className="block">
                <span className="text-sm font-semibold text-muted">Kategori Kustom</span>
                <input
                  className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Misal: Cicilan Furniture"
                />
              </label>
            ) : null}

            <label className="block">
              <span className="text-sm font-semibold text-muted">Cicilan / Bulan (Rp) — opsional</span>
              <input
                className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
                inputMode="numeric"
                value={formatThousands(monthlyInstallment)}
                onChange={(e) => setMonthlyInstallment(parseThousands(e.target.value).replace(/\D/g, ""))}
                placeholder="Kosongkan untuk tidak mengubah"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted">Jatuh Tempo Berikutnya</span>
              <input
                type="date"
                className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
              />
              {nextDueDate ? (
                <button
                  type="button"
                  onClick={() => setNextDueDate("")}
                  className="mt-1 text-xs font-semibold text-expense underline"
                >
                  Hapus jatuh tempo
                </button>
              ) : null}
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted">Target Lunas — opsional</span>
              <input
                type="date"
                className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
              {targetDate ? (
                <button
                  type="button"
                  onClick={() => setTargetDate("")}
                  className="mt-1 text-xs font-semibold text-expense underline"
                >
                  Hapus target lunas
                </button>
              ) : null}
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted">Catatan — opsional</span>
              <textarea
                className="mt-1 min-h-20 w-full rounded-lg border border-outline bg-surface p-3 focus:border-primary focus:outline-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nomor akun, kontak, dll."
                rows={3}
              />
            </label>

            {error ? (
              <p className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3">
          <button
            type="submit"
            disabled={busy}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}
