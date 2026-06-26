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
  const [showTenorDialog, setShowTenorDialog] = useState(false);
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

  const tenorButtons = [...TENOR_PRESETS, "custom" as const];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4 lg:items-center lg:p-6" role="dialog" aria-modal="true">
      <form
        onSubmit={submit}
        className="flex w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-lift sm:rounded-2xl lg:max-w-lg"
        style={{ maxHeight: "min(90dvh, calc(100dvh - env(safe-area-inset-bottom, 0px)))" }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
          <h3 className="text-lg font-bold text-ink">Tambah Hutang</h3>
          <button type="button" onClick={onClose} aria-label="Tutup" className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-container">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-semibold text-muted">Nama / Jenis Hutang</span>
              <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={name} onChange={(e) => setName(e.target.value)} placeholder="KPR Rumah" />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted">Kreditur</span>
              <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={creditorName} onChange={(e) => setCreditorName(e.target.value)} placeholder="Bank / Orang yang dituju" />
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
                <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Misal: Cicilan Furniture" />
              </label>
            ) : null}

            <label className="block">
              <span className="text-sm font-semibold text-muted">Total Pinjaman (Rp)</span>
              <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" inputMode="numeric" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="10000000" />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted">Sisa Hutang (Rp) — opsional</span>
              <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" inputMode="numeric" value={remainingAmount} onChange={(e) => setRemainingAmount(e.target.value)} placeholder="Kosongkan jika baru diambil" />
              <span className="mt-1 block text-xs text-muted">Isi jika hutang sudah sebagian dibayar sebelum dicatat.</span>
            </label>

            <div className="block">
              <span className="text-sm font-semibold text-muted">Cicilan Berapa Kali (Tenor)</span>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {tenorButtons.map((value) => {
                  const active = tenorMode === value;
                  const label =
                    value === "custom"
                      ? tenorMode === "custom" && tenorMonths > 0
                        ? `${tenorMonths} bln`
                        : "Custom"
                      : `${value} bln`;
                  return (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => {
                        if (value === "custom") {
                          setShowTenorDialog(true);
                        } else {
                          setTenorMode(value);
                        }
                      }}
                      className={`flex min-h-11 items-center justify-center rounded-lg border px-2 text-sm font-semibold transition active:scale-[0.98] ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-outline bg-surface-container text-ink hover:border-primary/40"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {tenorMode === "custom" && tenorMonths > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowTenorDialog(true)}
                  className="mt-1 text-xs font-semibold text-primary underline"
                >
                  Ubah tenor custom ({tenorMonths} bulan)
                </button>
              ) : null}
            </div>


            <label className="block">
              <span className="text-sm font-semibold text-muted">Bunga per Bulan (%) — opsional</span>
              <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" inputMode="decimal" value={interestPctMonth} onChange={(e) => setInterestPctMonth(e.target.value)} placeholder="Misal: 2.1" />
              <span className="mt-1 block text-xs text-muted">Sistem hitung cicilan/bulan otomatis dari bunga + tenor.</span>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted">Cicilan / Bulan (Rp) — opsional</span>
              <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" inputMode="numeric" value={manualInstallment} onChange={(e) => setManualInstallment(e.target.value)} placeholder="Isi manual untuk override hitungan" />
            </label>

            {principalMinor > 0 && tenorMonths > 0 && effectiveMonthly > 0 ? (
              <div className="rounded-lg bg-surface-container px-3 py-2 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Cicilan / Bulan</span>
                  <span className="font-bold text-primary">{formatCurrency(effectiveMonthly, "IDR")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Tenor</span>
                  <span className="font-semibold text-ink">{tenorMonths} bulan</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Hutang Pokok</span>
                  <span className="font-semibold text-ink">{formatCurrency(principalMinor, "IDR")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Total Bayar (pokok + bunga)</span>
                  <span className="font-semibold text-ink">{formatCurrency(totalPay, "IDR")}</span>
                </div>
                <div className="flex items-center justify-between border-t border-outline pt-1">
                  <span className="text-muted">Total Bunga</span>
                  <span className="font-semibold text-warning">{formatCurrency(totalInterest, "IDR")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Bunga / Bulan</span>
                  <span className="font-semibold text-warning">
                    {formatCurrency(tenorMonths > 0 ? Math.round(totalInterest / tenorMonths) : 0, "IDR")} · {interestPctMonthDerived.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Bunga Total</span>
                  <span className="font-semibold text-warning">{interestPctTotal.toFixed(2)}%</span>
                </div>
              </div>
            ) : null}

            <label className="block">
              <span className="text-sm font-semibold text-muted">Jatuh Tempo Berikutnya</span>
              <input type="date" className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted">Target Lunas — opsional</span>
              <input type="date" className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted">Catatan — opsional</span>
              <textarea className="mt-1 min-h-20 w-full rounded-lg border border-outline bg-surface p-3 focus:border-primary focus:outline-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Nomor akun, kontak, dll." rows={3} />
            </label>

            {error ? <p className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p> : null}
          </div>
        </div>

        <div className="shrink-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3">
          <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98] disabled:opacity-60">
            {busy ? "Menyimpan..." : "Simpan Hutang"}
          </button>
        </div>
      </form>

      {showTenorDialog ? (
        <CustomTenorDialog
          initialValue={customTenor}
          onCancel={() => setShowTenorDialog(false)}
          onConfirm={(months) => {
            setCustomTenor(String(months));
            setTenorMode("custom");
            setShowTenorDialog(false);
          }}
        />
      ) : null}
    </div>
  );
}

function CustomTenorDialog({
  initialValue,
  onCancel,
  onConfirm
}: {
  initialValue: string;
  onCancel: () => void;
  onConfirm: (months: number) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const QUICK_OPTIONS = [3, 18, 24, 36, 48, 60];

  function confirm() {
    const months = Math.round(Number(value) || 0);
    if (!Number.isFinite(months) || months <= 0) {
      setError("Masukkan jumlah bulan lebih dari 0.");
      return;
    }
    if (months > 600) {
      setError("Tenor maksimal 600 bulan (50 tahun).");
      return;
    }
    onConfirm(months);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-lift">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-ink">Tenor Cicilan Custom</h3>
            <p className="mt-1 text-sm text-muted">Masukkan jumlah bulan cicilan sesuai keinginan Anda.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Tutup" className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-container">
            <X size={20} />
          </button>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-muted">Jumlah Bulan</span>
          <input
            className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 text-center text-lg font-bold focus:border-primary focus:outline-none"
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="Misal: 24"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
            }}
          />
        </label>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {QUICK_OPTIONS.map((months) => (
            <button
              key={months}
              type="button"
              onClick={() => {
                setValue(String(months));
                setError(null);
              }}
              className={`flex min-h-10 items-center justify-center rounded-lg border px-2 text-sm font-semibold transition active:scale-[0.98] ${
                Number(value) === months
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-outline bg-surface-container text-ink hover:border-primary/40"
              }`}
            >
              {months} bln
            </button>
          ))}
        </div>

        {error ? <p className="mt-3 rounded-lg bg-error-container p-2 text-sm text-on-error-container">{error}</p> : null}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel} className="min-h-11 flex-1 rounded-lg bg-surface-container px-4 font-bold text-ink active:scale-[0.98]">
            Batal
          </button>
          <button type="button" onClick={confirm} className="min-h-11 flex-1 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98]">
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

