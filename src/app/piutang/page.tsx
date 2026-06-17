"use client";

import { AlertTriangle, Calendar, HandCoins, NotebookPen, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppFrame } from "@/components/app-frame";
import { usePrivacy } from "@/components/privacy-provider";
import { formatCurrency } from "@/lib/money";

type Receivable = {
  id: string;
  name: string;
  borrower_name: string;
  total_amount_minor: number;
  collected_amount_minor: number;
  remaining_amount_minor: number;
  due_date: string | null;
  notes: string | null;
  status: string;
};

type Summary = {
  total_lent_minor: number;
  total_collected_minor: number;
  total_remaining_minor: number;
};

export default function PiutangPage() {
  return (
    <AppFrame title="Piutang" subtitle="Akun">
      <PiutangContent />
    </AppFrame>
  );
}

function PiutangContent() {
  const { displayAmount } = usePrivacy();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_lent_minor: 0, total_collected_minor: 0, total_remaining_minor: 0 });
  const [plan, setPlan] = useState<"free" | "premium" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [payTarget, setPayTarget] = useState<Receivable | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, res] = await Promise.all([
        fetch("/api/profile", { cache: "no-store" }),
        fetch("/api/receivables", { cache: "no-store" })
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
        setReceivables((json.receivables ?? []) as Receivable[]);
        setSummary((json.summary ?? { total_lent_minor: 0, total_collected_minor: 0, total_remaining_minor: 0 }) as Summary);
      } else {
        setError("Gagal memuat data piutang.");
      }
    } catch {
      setError("Gagal memuat data piutang.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function archive(id: string) {
    if (!window.confirm("Hapus piutang ini?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/receivables/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Gagal menghapus piutang.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function recordPayment(receivable: Receivable, amountMinor: number) {
    setBusyId(receivable.id);
    try {
      const res = await fetch(`/api/receivables/${receivable.id}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount_minor: amountMinor })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Gagal mencatat penagihan.");
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

  const progressPct = summary.total_lent_minor > 0
    ? Math.min(100, Math.round((summary.total_collected_minor / summary.total_lent_minor) * 100))
    : 0;

  return (
    <div className="mt-5 space-y-5">
      {error ? <p className="rounded-lg bg-error-container p-3 text-sm font-semibold text-on-error-container">{error}</p> : null}

      <SummaryCard
        collectedMinor={summary.total_collected_minor}
        lentMinor={summary.total_lent_minor}
        remainingMinor={summary.total_remaining_minor}
        progressPct={progressPct}
        displayAmount={displayAmount}
      />

      {loading ? (
        <p className="rounded-xl bg-surface p-5 text-center text-sm text-muted shadow-card">Memuat piutang...</p>
      ) : receivables.length === 0 ? (
        <div className="rounded-xl bg-surface p-6 text-center shadow-card">
          <HandCoins aria-hidden="true" className="mx-auto size-10 text-muted" />
          <p className="mt-2 font-semibold text-ink">Belum ada piutang</p>
          <p className="mt-1 text-sm text-muted">Catat uang yang Anda pinjamkan ke orang lain untuk memantau penagihan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {receivables.map((receivable) => (
            <ReceivableCard
              key={receivable.id}
              receivable={receivable}
              busy={busyId === receivable.id}
              onPay={() => setPayTarget(receivable)}
              onDelete={() => archive(receivable.id)}
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
        Tambah Piutang
      </button>

      {showForm ? (
        <ReceivableFormSheet
          onClose={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false);
            await load();
          }}
        />
      ) : null}

      {payTarget ? (
        <PaymentDialog
          receivable={payTarget}
          busy={busyId === payTarget.id}
          onCancel={() => setPayTarget(null)}
          onConfirm={(amount) => recordPayment(payTarget, amount)}
          displayAmount={displayAmount}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({
  collectedMinor,
  lentMinor,
  remainingMinor,
  progressPct,
  displayAmount
}: {
  collectedMinor: number;
  lentMinor: number;
  remainingMinor: number;
  progressPct: number;
  displayAmount: (value: string) => string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-container p-5 text-white shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Progress Penagihan</p>
      <p className="mt-1 text-3xl font-bold">{displayAmount(formatCurrency(collectedMinor, "IDR"))}</p>
      <p className="text-xs text-white/70">Terkumpul</p>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/25">
        <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-white/70">{progressPct}% terkumpul</p>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/70">Total Dipinjamkan</p>
          <p className="text-base font-bold">{displayAmount(formatCurrency(lentMinor, "IDR"))}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/70">Sisa Tagihan</p>
          <p className="text-base font-bold">{displayAmount(formatCurrency(remainingMinor, "IDR"))}</p>
        </div>
      </div>
    </section>
  );
}

function ReceivableCard({
  receivable,
  busy,
  onPay,
  onDelete,
  displayAmount
}: {
  receivable: Receivable;
  busy: boolean;
  onPay: () => void;
  onDelete: () => void;
  displayAmount: (value: string) => string;
}) {
  const progressPct = receivable.total_amount_minor > 0
    ? Math.min(100, Math.round((receivable.collected_amount_minor / receivable.total_amount_minor) * 100))
    : 0;
  const dueDate = receivable.due_date ? new Date(receivable.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : null;
  const initial = receivable.borrower_name.trim().charAt(0).toUpperCase() || "?";

  return (
    <article className="rounded-xl bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{initial}</div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-bold text-ink">{receivable.name}</h4>
          <p className="truncate text-xs text-muted">{receivable.borrower_name}</p>
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
          <p className="text-[11px] uppercase tracking-wider text-muted">Total Piutang</p>
          <p className="text-sm font-bold text-ink">{displayAmount(formatCurrency(receivable.total_amount_minor, "IDR"))}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Sisa Belum Dibayar</p>
          <p className="text-sm font-bold text-expense">{displayAmount(formatCurrency(receivable.remaining_amount_minor, "IDR"))}</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
        <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted">
        {displayAmount(formatCurrency(receivable.collected_amount_minor, "IDR"))} terkumpul · {progressPct}%
      </p>

      {dueDate ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted">
          <Calendar aria-hidden="true" size={12} />
          Jatuh tempo {dueDate}
        </p>
      ) : null}

      {receivable.notes ? (
        <p className="mt-1 flex items-start gap-1 text-xs text-muted">
          <NotebookPen aria-hidden="true" size={12} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{receivable.notes}</span>
        </p>
      ) : null}

      {receivable.remaining_amount_minor > 0 ? (
        <button
          type="button"
          onClick={onPay}
          disabled={busy}
          className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-60"
        >
          <HandCoins size={16} />
          Catat Penagihan
        </button>
      ) : (
        <p className="mt-3 rounded-lg bg-income/10 p-2 text-center text-xs font-semibold text-income">Lunas terkumpul</p>
      )}
    </article>
  );
}

function ReceivableFormSheet({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [borrowerName, setBorrowerName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [remainingAmount, setRemainingAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const totalMinor = Math.round(Number(totalAmount));
    const remainingMinor = remainingAmount.trim() === "" ? totalMinor : Math.round(Number(remainingAmount));

    if (!name.trim()) return setError("Nama piutang wajib diisi.");
    if (!borrowerName.trim()) return setError("Nama peminjam wajib diisi.");
    if (!Number.isFinite(totalMinor) || totalMinor <= 0) return setError("Total piutang harus lebih dari 0.");
    if (remainingMinor < 0 || remainingMinor > totalMinor) return setError("Sisa awal tidak valid.");

    setBusy(true);
    try {
      const res = await fetch("/api/receivables", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          borrower_name: borrowerName.trim(),
          total_amount_minor: totalMinor,
          initial_remaining_amount_minor: remainingMinor,
          due_date: dueDate ? new Date(`${dueDate}T09:00:00.000Z`).toISOString() : null,
          notes: notes.trim() || null
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Gagal menyimpan piutang.");
        return;
      }
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <form
        onSubmit={submit}
        className="flex w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-lift sm:rounded-2xl"
        style={{ maxHeight: "min(90dvh, calc(100dvh - env(safe-area-inset-bottom, 0px)))" }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
          <h3 className="text-lg font-bold text-ink">Tambah Piutang</h3>
          <button type="button" onClick={onClose} aria-label="Tutup" className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-container">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-semibold text-muted">Nama Piutang</span>
              <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pinjaman usaha" />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted">Orang yang Meminjam</span>
              <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} placeholder="Nama lengkap" />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted">Total Piutang (Rp)</span>
              <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" inputMode="numeric" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="1000000" />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted">Sisa Belum Dibayar (Rp) — opsional</span>
              <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" inputMode="numeric" value={remainingAmount} onChange={(e) => setRemainingAmount(e.target.value)} placeholder="Kosongkan jika baru dipinjamkan" />
              <span className="mt-1 block text-xs text-muted">Isi hanya jika piutang sudah sebagian terkumpul sebelum dicatat.</span>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted">Jatuh Tempo — opsional</span>
              <input type="date" className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted">Catatan — opsional</span>
              <textarea className="mt-1 min-h-20 w-full rounded-lg border border-outline bg-surface p-3 focus:border-primary focus:outline-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tujuan pinjaman, kontak, dll." rows={3} />
            </label>

            {error ? <p className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p> : null}
          </div>
        </div>

        <div className="shrink-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3">
          <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98] disabled:opacity-60">
            {busy ? "Menyimpan..." : "Simpan Piutang"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PaymentDialog({
  receivable,
  busy,
  onCancel,
  onConfirm,
  displayAmount
}: {
  receivable: Receivable;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (amountMinor: number) => void;
  displayAmount: (value: string) => string;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountMinor = Math.round(Number(amount));
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError("Nominal harus lebih dari 0.");
      return;
    }
    if (amountMinor > receivable.remaining_amount_minor) {
      setError("Nominal melebihi sisa piutang.");
      return;
    }
    onConfirm(amountMinor);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-lift">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HandCoins size={20} />
          </span>
          <div>
            <h3 className="font-bold text-ink">Catat Penagihan</h3>
            <p className="mt-1 text-sm text-muted">
              {receivable.name} · Sisa {displayAmount(formatCurrency(receivable.remaining_amount_minor, "IDR"))}
            </p>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-muted">Jumlah Terkumpul (Rp)</span>
          <input
            className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500000"
            autoFocus
          />
        </label>
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
