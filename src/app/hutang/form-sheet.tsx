"use client";

import { X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { SelectMenu } from "@/components/ui/select-menu";
import { DEBT_CATEGORIES } from "@/lib/entitlements";
import { formatCurrency } from "@/lib/money";

const CATEGORY_OPTIONS = [
  ...DEBT_CATEGORIES.map((value) => ({ value, label: value })),
  { value: "__custom__", label: "Lainnya (ketik sendiri)" }
];

const TENOR_PRESETS = [1, 6, 12];

function calcFlatMonthly(principal: number, months: number, bpsPerMonth: number): number {
  if (months <= 0) return 0;
  const rate = bpsPerMonth / 10000;
  const totalInterest = principal * rate * months;
  return Math.ceil((principal + totalInterest) / months);
}

export function DebtFormSheet({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [creditorName, setCreditorName] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [remainingAmount, setRemainingAmount] = useState("");

  // Cicilan / tenor state
  const [tenorMode, setTenorMode] = useState<number | "custom">(12);
  const [customTenor, setCustomTenor] = useState("");
  const [interestPctMonth, setInterestPctMonth] = useState("");
  // Optional manual override; if empty, the calculator computes it from tenor + bunga
  const [manualInstallment, setManualInstallment] = useState("");

  const [nextDueDate, setNextDueDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustom = category === "__custom__";
  const effectiveCategory = useMemo(
    () => (isCustom ? customCategory.trim() : category),
    [isCustom, customCategory, category]
  );

  // Resolve tenor (months) from preset / custom
  const tenorMonths = useMemo(() => {
    if (tenorMode === "custom") {
      const n = Math.round(Number(customTenor) || 0);
      return n > 0 ? n : 0;
    }
    return tenorMode;
  }, [tenorMode, customTenor]);

  const principalMinor = Math.round(Number(totalAmount) || 0);
  const bpsPerMonth = Math.round((Number(interestPctMonth) || 0) * 100); // 1% = 100 bps
  const computedMonthly = useMemo(() => {
    if (principalMinor <= 0 || tenorMonths <= 0) return 0;
    return calcFlatMonthly(principalMinor, tenorMonths, bpsPerMonth);
  }, [principalMinor, tenorMonths, bpsPerMonth]);

  // If user typed a manual installment, use that. Otherwise use computed.
  const manualMinor = manualInstallment.trim() === "" ? null : Math.round(Number(manualInstallment) || 0);
  const effectiveMonthly = manualMinor && manualMinor > 0 ? manualMinor : computedMonthly;

  // Derived totals for preview
  const totalPay = effectiveMonthly > 0 && tenorMonths > 0 ? effectiveMonthly * tenorMonths : 0;
  const totalInterest = totalPay > 0 && principalMinor > 0 ? Math.max(0, totalPay - principalMinor) : 0;
  const interestPctTotal = principalMinor > 0 && totalInterest > 0 ? (totalInterest / principalMinor) * 100 : 0;
  const interestPctMonthDerived = tenorMonths > 0 ? interestPctTotal / tenorMonths : 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const totalMinor = principalMinor;
    const remainingMinor = remainingAmount.trim() === "" ? totalMinor : Math.round(Number(remainingAmount) || 0);
    const monthlyMinor = effectiveMonthly > 0 ? effectiveMonthly : null;

    if (!name.trim()) return setError("Nama hutang wajib diisi.");
    if (!creditorName.trim()) return setError("Nama kreditur wajib diisi.");
    if (!effectiveCategory) return setError("Kategori wajib dipilih.");
    if (!Number.isFinite(totalMinor) || totalMinor <= 0) return setError("Total pinjaman harus lebih dari 0.");
    if (remainingMinor < 0 || remainingMinor > totalMinor) return setError("Sisa hutang tidak valid.");
    if (tenorMode === "custom" && tenorMonths <= 0) return setError("Tenor cicilan harus lebih dari 0 bulan.");

    setBusy(true);
    try {
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          creditor_name: creditorName.trim(),
          category: effectiveCategory,
          total_amount_minor: totalMinor,
          initial_remaining_amount_minor: remainingMinor,
          installment_months: tenorMonths > 0 ? tenorMonths : null,
          interest_rate_per_month_bps: bpsPerMonth >= 0 ? bpsPerMonth : null,
          monthly_installment_minor: monthlyMinor,
          next_due_date: nextDueDate ? new Date(`${nextDueDate}T09:00:00.000Z`).toISOString() : null,
          target_paid_off_date: targetDate ? new Date(`${targetDate}T09:00:00.000Z`).toISOString() : null,
          notes: notes.trim() || null
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Gagal menyimpan hutang.");
        return;
      }
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return null;
}
