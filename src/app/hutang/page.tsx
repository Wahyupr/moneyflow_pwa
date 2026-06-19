"use client";

import { AlertTriangle, Landmark, Plus, WalletCards } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppFrame } from "@/components/app-frame";
import { usePrivacy } from "@/components/privacy-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCurrency } from "@/lib/money";
import { DebtCard, type Debt } from "./components";
import { DebtFormSheet } from "./form-sheet";

type Summary = {
  total_principal_minor: number;
  total_paid_minor: number;
  total_remaining_minor: number;
  total_monthly_installment_minor: number;
};

export default function HutangPage() {
  return (
    <AppFrame title="Hutang" subtitle="Akun">
      <HutangContent />
    </AppFrame>
  );
}

function HutangContent() {
  const { displayAmount } = usePrivacy();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_principal_minor: 0, total_paid_minor: 0, total_remaining_minor: 0, total_monthly_installment_minor: 0 });
  const [plan, setPlan] = useState<"free" | "premium" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [payTarget, setPayTarget] = useState<Debt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, res] = await Promise.all([
        fetch("/api/profile", { cache: "no-store" }),
        fetch("/api/debts", { cache: "no-store" })
      ]);
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setPlan((profile.entitlement?.plan as "free" | "premium") ?? "free");
      }
      if (res.status === 402) {
        setPlan("free");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setDebts((json.debts ?? []) as Debt[]);
        setSummary((json.summary ?? { total_principal_minor: 0, total_paid_minor: 0, total_remaining_minor: 0, total_monthly_installment_minor: 0 }) as Summary);
      } else {
        setError("Gagal memuat data hutang.");
      }
    } catch {
      setError("Gagal memuat data hutang.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function archive(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/debts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Gagal menghapus hutang.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function recordPayment(debt: Debt, amountMinor: number) {
    setBusyId(debt.id);
    try {
      const res = await fetch(`/api/debts/${debt.id}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount_minor: amountMinor })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Gagal mencatat pembayaran.");
        return;
      }
      setPayTarget(null);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (plan === "free") {
    return <PremiumGate />;
  }

  const progressPct = summary.total_principal_minor > 0
    ? Math.min(100, Math.round((summary.total_paid_minor / summary.total_principal_minor) * 100))
    : 0;

  return (
    <div className="mt-5 space-y-5">
      {error ? <p className="rounded-lg bg-error-container p-3 text-sm font-semibold text-on-error-container">{error}</p> : null}

      <SummaryCard
        remainingMinor={summary.total_remaining_minor}
        paidMinor={summary.total_paid_minor}
        principalMinor={summary.total_principal_minor}
        monthlyInstallmentMinor={summary.total_monthly_installment_minor}
        progressPct={progressPct}
        displayAmount={displayAmount}
      />

      {loading ? (
        <p className="rounded-xl bg-surface p-5 text-center text-sm text-muted shadow-card">Memuat hutang...</p>
      ) : debts.length === 0 ? (
        <div className="rounded-xl bg-surface p-6 text-center shadow-card">
          <Landmark aria-hidden="true" className="mx-auto size-10 text-muted" />
          <p className="mt-2 font-semibold text-ink">Belum ada hutang</p>
          <p className="mt-1 text-sm text-muted">Catat KPR, cicilan kendaraan, atau pinjaman lain untuk memantau pelunasan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {debts.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              busy={busyId === debt.id}
              onPay={() => setPayTarget(debt)}
              onDelete={() => setDeleteTarget(debt)}
              displayAmount={displayAmount}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-white shadow-card active:scale-[0.98]"
        onClick={() => setShowForm(true)}
      >
        <Plus size={20} />
        Tambah Hutang
      </button>

      {showForm ? (
        <DebtFormSheet
          onClose={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false);
            await load();
          }}
        />
      ) : null}

      {payTarget ? (
        <PaymentDialog
          debt={payTarget}
          busy={busyId === payTarget.id}
          onCancel={() => setPayTarget(null)}
          onConfirm={(amount) => recordPayment(payTarget, amount)}
          displayAmount={displayAmount}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Hapus Hutang?"
          message={`Hutang "${deleteTarget.name}" akan dihapus. Riwayat pembayaran tetap tersimpan untuk audit.`}
          confirmLabel="Ya, Hapus"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            const id = deleteTarget.id;
            setDeleteTarget(null);
            void archive(id);
          }}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({
  remainingMinor,
  paidMinor,
  principalMinor,
  monthlyInstallmentMinor,
  progressPct,
  displayAmount
}: {
  remainingMinor: number;
  paidMinor: number;
  principalMinor: number;
  monthlyInstallmentMinor: number;
  progressPct: number;
  displayAmount: (value: string) => string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-ink to-primary-container p-5 text-white shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Total Sisa Hutang</p>
      <p className="mt-1 text-3xl font-bold">{displayAmount(formatCurrency(remainingMinor, "IDR"))}</p>

      <div className="mt-4">
        <div className="flex items-end justify-between">
          <p className="text-[11px] uppercase tracking-wider text-white/70">Progress Pelunasan</p>
          <p className="text-xs font-semibold text-white/90">{displayAmount(formatCurrency(paidMinor, "IDR"))} terbayar</p>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-tertiary" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-white/70">{progressPct}% lunas</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/70">Tagihan Pokok</p>
          <p className="text-base font-bold">{displayAmount(formatCurrency(principalMinor, "IDR"))}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/70">Cicilan / Bulan</p>
          <p className="text-base font-bold">{displayAmount(formatCurrency(monthlyInstallmentMinor, "IDR"))}</p>
        </div>
      </div>
    </section>
  );
}

function PaymentDialog({
  debt,
  busy,
  onCancel,
  onConfirm,
  displayAmount
}: {
  debt: Debt;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (amountMinor: number) => void;
  displayAmount: (value: string) => string;
}) {
  const [amount, setAmount] = useState("");
  const [bungaPct, setBungaPct] = useState("");
  const [adjType, setAdjType] = useState<"fee" | "discount">("fee");
  const [adjAmount, setAdjAmount] = useState("");
  const [error, setError] = useState<string | null>(null);


  const remaining = debt.remaining_amount_minor;
  const halfInstallment = debt.monthly_installment_minor
    ? Math.min(Math.round(debt.monthly_installment_minor / 2), remaining)
    : null;
  const fullInstallment = debt.monthly_installment_minor
    ? Math.min(debt.monthly_installment_minor, remaining)
    : null;

  const quickOptions: Array<{ label: string; amount: number }> = [];
  if (halfInstallment && halfInstallment > 0 && halfInstallment !== fullInstallment) {
    quickOptions.push({ label: "50% Cicilan", amount: halfInstallment });
  }
  if (fullInstallment && fullInstallment > 0 && fullInstallment !== remaining) {
    quickOptions.push({ label: "1x Cicilan", amount: fullInstallment });
  }
  if (remaining > 0) {
    quickOptions.push({ label: "Lunas", amount: remaining });
  }

  const principalMinor = Math.round(Number(amount) || 0);
  const pct = Math.max(0, Math.min(100, Number(bungaPct) || 0));
  const bungaMinor = pct > 0 ? Math.round((principalMinor * pct) / 100) : 0;
  const adjMinor = Math.max(0, Math.round(Number(adjAmount) || 0));
  const adjSigned = adjType === "fee" ? adjMinor : -adjMinor;
  const totalMinor = Math.max(0, principalMinor + bungaMinor + adjSigned);
  const hasBreakdown = bungaMinor > 0 || adjMinor > 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isFinite(principalMinor) || principalMinor <= 0) {
      setError("Nominal pokok harus lebih dari 0.");
      return;
    }
    if (principalMinor > debt.remaining_amount_minor) {
      setError("Nominal pokok melebihi sisa hutang.");
      return;
    }
    onConfirm(totalMinor);
  }


  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-lift">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <WalletCards size={20} />
          </span>
          <div>
            <h3 className="font-bold text-ink">Catat Pembayaran</h3>
            <p className="mt-1 text-sm text-muted">
              {debt.name} · Sisa {displayAmount(formatCurrency(debt.remaining_amount_minor, "IDR"))}
            </p>
          </div>
        </div>

        {quickOptions.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {quickOptions.map((option) => {
              const active = Number(amount) === option.amount;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => { setAmount(String(option.amount)); setError(null); }}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 transition active:scale-[0.98] ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline bg-surface-container text-ink hover:border-primary/40"
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{option.label}</span>
                  <span className="text-xs font-bold">{displayAmount(formatCurrency(option.amount, "IDR"))}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-muted">Pokok Pembayaran (Rp)</span>
          <input
            className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
            inputMode="numeric"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(null); }}
            placeholder="2800000"
            autoFocus
          />
        </label>

        <label className="mt-3 block">
          <span className="text-sm font-semibold text-muted">Bunga (%) — opsional</span>
          <input
            className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
            inputMode="decimal"
            value={bungaPct}
            onChange={(e) => { setBungaPct(e.target.value); setError(null); }}
            placeholder="0"
          />
        </label>

        <div className="mt-3">
          <span className="text-sm font-semibold text-muted">Biaya Admin / Diskon — opsional</span>
          <div className="mt-1 flex gap-2">
            <div className="flex shrink-0 overflow-hidden rounded-lg border border-outline">
              <button
                type="button"
                onClick={() => { setAdjType("fee"); setError(null); }}
                className={`min-h-12 px-3 text-sm font-semibold transition ${
                  adjType === "fee" ? "bg-primary text-white" : "bg-surface-container text-ink"
                }`}
              >
                Biaya
              </button>
              <button
                type="button"
                onClick={() => { setAdjType("discount"); setError(null); }}
                className={`min-h-12 px-3 text-sm font-semibold transition ${
                  adjType === "discount" ? "bg-primary text-white" : "bg-surface-container text-ink"
                }`}
              >
                Diskon
              </button>
            </div>
            <input
              className="min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
              inputMode="numeric"
              value={adjAmount}
              onChange={(e) => { setAdjAmount(e.target.value); setError(null); }}
              placeholder="2500"
            />
          </div>
          <span className="mt-1 block text-xs text-muted">
            {adjType === "fee" ? "Biaya admin ditambahkan ke total bayar." : "Diskon mengurangi total bayar."}
          </span>
        </div>

        {hasBreakdown ? (
          <div className="mt-3 rounded-lg bg-surface-container px-3 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted">Pokok</span>
              <span className="font-semibold text-ink">{displayAmount(formatCurrency(principalMinor, "IDR"))}</span>
            </div>
            {bungaMinor > 0 ? (
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted">Bunga ({pct}%)</span>
                <span className="font-semibold text-ink">{displayAmount(formatCurrency(bungaMinor, "IDR"))}</span>
              </div>
            ) : null}
            {adjMinor > 0 ? (
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted">{adjType === "fee" ? "Biaya Admin" : "Diskon"}</span>
                <span className={`font-semibold ${adjType === "fee" ? "text-ink" : "text-income"}`}>
                  {adjType === "fee" ? "+" : "−"}{displayAmount(formatCurrency(adjMinor, "IDR"))}
                </span>
              </div>
            ) : null}
            <div className="mt-1.5 flex items-center justify-between border-t border-outline pt-1.5">
              <span className="font-semibold text-ink">Total Dibayar</span>
              <span className="font-bold text-primary">{displayAmount(formatCurrency(totalMinor, "IDR"))}</span>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-2 rounded-lg bg-error-container p-2 text-sm text-on-error-container">{error}</p> : null}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 flex-1 rounded-lg bg-surface-container px-4 font-bold text-ink active:scale-[0.98]">
            Batal
          </button>
          <button type="submit" disabled={busy} className="min-h-11 flex-1 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98] disabled:opacity-60">
            {busy ? "Memproses..." : "Catat"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PremiumGate() {
  return (
    <div className="mt-5">
      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 text-center shadow-card">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning/15 text-warning">
          <AlertTriangle size={24} />
        </span>
        <h3 className="mt-3 text-base font-bold text-ink">Fitur Premium</h3>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
          Hutang & Piutang hanya tersedia untuk member Premium. Upgrade akun Anda untuk mulai melacak pinjaman dan tagihan.
        </p>
        <Link href="/settings" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 font-bold text-white active:scale-[0.98]">
          Kelola Langganan
        </Link>
      </div>
    </div>
  );
}
