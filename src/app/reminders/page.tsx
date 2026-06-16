"use client";

import { AlertTriangle, Bell, Plus, Repeat, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AppFrame } from "@/components/app-frame";
import { usePrivacy } from "@/components/privacy-provider";
import { SelectMenu } from "@/components/ui/select-menu";
import { formatCurrency } from "@/lib/money";

type Reminder = {
  id: string;
  name: string | null;
  amount_minor: number;
  wallet_id: string;
  category_id: string | null;
  merchant_id: string | null;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  next_run_at: string;
  remind_days_before: number;
  days_until: number;
  status: "overdue" | "due_today" | "due_soon" | "upcoming" | "scheduled";
  paid_for_current_period: boolean;
};

type WalletOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; type: "expense" | "income" | "transfer" };
type MerchantOption = { id: string; name: string; logo_url: string | null; category_id: string | null };

export default function RemindersPage() {
  return (
    <AppFrame title="Pengingat" subtitle="Langganan">
      <RemindersContent />
    </AppFrame>
  );
}

function RemindersContent() {
  const { displayAmount } = usePrivacy();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirming, setConfirming] = useState<Reminder | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [remindersRes, walletsRes, categoriesRes, merchantsRes] = await Promise.all([
        fetch("/api/reminders"),
        fetch("/api/wallets"),
        fetch("/api/categories"),
        fetch("/api/merchants")
      ]);
      if (remindersRes.ok) setReminders(((await remindersRes.json()).reminders ?? []) as Reminder[]);
      if (walletsRes.ok) setWallets(((await walletsRes.json()).wallets ?? []) as WalletOption[]);
      if (categoriesRes.ok) setCategories(((await categoriesRes.json()).categories ?? []) as CategoryOption[]);
      if (merchantsRes.ok) setMerchants(((await merchantsRes.json()).merchants ?? []) as MerchantOption[]);
    } catch {
      setError("Gagal memuat pengingat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Reminders that need attention right now (D-≤5 OR overdue OR due today),
  // not yet paid for the current period.
  const active = useMemo(
    () =>
      reminders.filter(
        (reminder) => !reminder.paid_for_current_period && reminder.days_until <= reminder.remind_days_before
      ),
    [reminders]
  );
  const others = useMemo(() => reminders.filter((reminder) => !active.includes(reminder)), [reminders, active]);

  async function payReminder(reminder: Reminder) {
    setBusyId(reminder.id);
    try {
      const response = await fetch(`/api/reminders/${reminder.id}/pay`, { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Gagal mencatat pembayaran.");
        return;
      }
      setConfirming(null);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function archiveReminder(id: string) {
    if (!window.confirm("Hapus pengingat ini?")) return;
    setBusyId(id);
    try {
      await fetch(`/api/reminders/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      {error ? <p className="rounded-lg bg-error-container p-3 text-sm font-semibold text-on-error-container">{error}</p> : null}

      {loading ? (
        <p className="rounded-xl bg-surface p-5 text-center text-sm text-muted shadow-card">Memuat pengingat...</p>
      ) : (
        <>
          {active.length > 0 ? (
            <section>
              <h3 className="mb-3 text-sm font-bold text-muted">PERLU PERHATIAN</h3>
              <div className="space-y-3">
                {active.map((reminder) => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    busy={busyId === reminder.id}
                    onPay={() => setConfirming(reminder)}
                    onDelete={() => archiveReminder(reminder.id)}
                    displayAmount={displayAmount}
                    merchantLogoUrl={merchants.find((m) => m.id === reminder.merchant_id)?.logo_url ?? null}
                    highlight
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="mb-3 text-sm font-bold text-muted">{others.length === 0 && active.length === 0 ? "PENGINGAT" : "JADWAL BERIKUTNYA"}</h3>
            {others.length === 0 && active.length === 0 ? (
              <div className="rounded-xl bg-surface p-6 text-center shadow-card">
                <p className="font-semibold text-ink">Belum ada pengingat</p>
                <p className="mt-1 text-sm text-muted">Buat pengingat untuk langganan rutin agar tidak terlewat.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {others.map((reminder) => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    busy={busyId === reminder.id}
                    onPay={() => setConfirming(reminder)}
                    onDelete={() => archiveReminder(reminder.id)}
                    displayAmount={displayAmount}
                    merchantLogoUrl={merchants.find((m) => m.id === reminder.merchant_id)?.logo_url ?? null}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <button
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-white shadow-card active:scale-[0.98]"
        type="button"
        onClick={() => setShowForm(true)}
      >
        <Plus size={20} />
        Tambah Pengingat Baru
      </button>

      {showForm ? (
        <ReminderFormSheet
          wallets={wallets}
          categories={categories}
          merchants={merchants}
          onClose={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false);
            await load();
          }}
        />
      ) : null}

      {confirming ? (
        <PayConfirmDialog
          reminder={confirming}
          walletName={wallets.find((wallet) => wallet.id === confirming.wallet_id)?.name ?? null}
          busy={busyId === confirming.id}
          onCancel={() => setConfirming(null)}
          onConfirm={() => payReminder(confirming)}
          displayAmount={displayAmount}
        />
      ) : null}
    </div>
  );
}

const FREQUENCY_LABEL: Record<Reminder["frequency"], string> = {
  daily: "Setiap hari",
  weekly: "Setiap minggu",
  monthly: "Setiap bulan",
  yearly: "Setiap tahun"
};

function statusLabel(reminder: Reminder): { text: string; tone: string } {
  if (reminder.paid_for_current_period) return { text: "Sudah dibayar", tone: "text-income" };
  switch (reminder.status) {
    case "overdue":
      return { text: `Terlambat ${Math.abs(reminder.days_until)} hari`, tone: "text-expense" };
    case "due_today":
      return { text: "Jatuh tempo hari ini", tone: "text-expense" };
    case "due_soon":
      return { text: `${reminder.days_until} hari lagi`, tone: "text-warning" };
    case "upcoming":
      return { text: `${reminder.days_until} hari lagi`, tone: "text-warning" };
    default:
      return { text: `${reminder.days_until} hari lagi`, tone: "text-muted" };
  }
}

function ReminderCard({
  reminder,
  busy,
  onPay,
  onDelete,
  displayAmount,
  merchantLogoUrl,
  highlight
}: {
  reminder: Reminder;
  busy: boolean;
  onPay: () => void;
  onDelete: () => void;
  displayAmount: (value: string) => string;
  merchantLogoUrl?: string | null;
  highlight?: boolean;
}) {
  const status = statusLabel(reminder);
  const initial = (reminder.name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const dueDate = new Date(reminder.next_run_at).toLocaleDateString("id-ID", { day: "numeric", month: "long" });

  return (
    <article className={`rounded-xl bg-surface p-4 shadow-card ${highlight && !reminder.paid_for_current_period ? "border-2 border-warning/60" : ""}`}>
      <div className="flex items-center gap-3">
        {merchantLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={merchantLogoUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{initial}</div>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-bold text-ink">{reminder.name ?? "Pengingat"}</h4>
          <p className="text-xs text-muted">{FREQUENCY_LABEL[reminder.frequency]} · jatuh tempo {dueDate}</p>
          <p className={`text-xs font-semibold ${status.tone}`}>{status.text}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-ink">{displayAmount(formatCurrency(reminder.amount_minor, "IDR"))}</p>
          <button className="mt-1 text-muted transition hover:text-expense disabled:opacity-50" disabled={busy} onClick={onDelete} type="button" aria-label="Hapus">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {!reminder.paid_for_current_period ? (
        <button
          className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-60"
          disabled={busy}
          onClick={onPay}
          type="button"
        >
          <Bell size={16} />
          Tandai sudah dibayar
        </button>
      ) : null}
    </article>
  );
}

function PayConfirmDialog({
  reminder,
  walletName,
  busy,
  onCancel,
  onConfirm,
  displayAmount
}: {
  reminder: Reminder;
  walletName: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  displayAmount: (value: string) => string;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-lift">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h3 className="font-bold text-ink">Konfirmasi pembayaran</h3>
            <p className="mt-1 text-sm text-muted">
              Ini akan mencatat pengeluaran <strong>{displayAmount(formatCurrency(reminder.amount_minor, "IDR"))}</strong>
              {walletName ? <> dari dompet <strong>{walletName}</strong></> : null} dan mengurangi saldomu.
            </p>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button className="min-h-11 flex-1 rounded-lg bg-surface-container px-4 font-bold text-ink active:scale-[0.98]" disabled={busy} onClick={onCancel} type="button">
            Batal
          </button>
          <button className="min-h-11 flex-1 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98] disabled:opacity-60" disabled={busy} onClick={onConfirm} type="button">
            {busy ? "Memproses..." : "Ya, bayar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReminderFormSheet({
  wallets,
  categories,
  merchants,
  onClose,
  onSaved
}: {
  wallets: WalletOption[];
  categories: CategoryOption[];
  merchants: MerchantOption[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const expenseCategories = useMemo(() => categories.filter((category) => category.type === "expense"), [categories]);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<Reminder["frequency"]>("monthly");
  const [dueDate, setDueDate] = useState("");
  const [remindDays, setRemindDays] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pick a merchant to prefill the name + category (the user's subscriptions
  // are usually known merchants, e.g. "Claude Pro").
  function pickMerchant(value: string) {
    const merchant = merchants.find((item) => item.id === value);
    if (!merchant) return;
    setMerchantId(merchant.id);
    setName(merchant.name);
    if (merchant.category_id) setCategoryId(merchant.category_id);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const amountMinor = Math.round(Number(amount));
    if (!name.trim()) return setError("Nama pengingat wajib diisi.");
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) return setError("Nominal harus lebih dari 0.");
    if (!walletId) return setError("Pilih dompet.");
    if (!dueDate) return setError("Pilih tanggal jatuh tempo.");

    setBusy(true);
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          amount_minor: amountMinor,
          wallet_id: walletId,
          category_id: categoryId || null,
          merchant_id: merchantId,
          frequency,
          next_run_at: new Date(`${dueDate}T09:00:00.000Z`).toISOString(),
          remind_days_before: remindDays
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Gagal menyimpan pengingat.");
        return;
      }
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="flex w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-lift sm:rounded-2xl" style={{ maxHeight: "min(90dvh, calc(100dvh - env(safe-area-inset-bottom, 0px)))" }}>
        {/* Fixed header */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
          <h3 className="text-lg font-bold text-ink">Pengingat Baru</h3>
          <button className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-container" onClick={onClose} type="button" aria-label="Tutup">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
        <div className="space-y-3">
          {merchants.length > 0 ? (
            <div>
              <span className="text-sm font-semibold text-muted">Dari merchant (opsional)</span>
              <SelectMenu
                ariaLabel="Merchant"
                value=""
                onChange={pickMerchant}
                placeholder="Pilih merchant langganan"
                options={merchants.map((merchant) => ({
                  value: merchant.id,
                  label: merchant.name,
                  icon: merchant.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={merchant.logo_url} alt="" className="size-5 rounded-full object-cover" />
                  ) : undefined
                }))}
              />
            </div>
          ) : null}

          <label className="block">
            <span className="text-sm font-semibold text-muted">Nama</span>
            <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={name} onChange={(event) => setName(event.target.value)} placeholder="Claude Pro" />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-muted">Nominal (Rp)</span>
            <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="300000" />
          </label>

          <div className="block">
            <span className="text-sm font-semibold text-muted">Dompet</span>
            <SelectMenu
              ariaLabel="Dompet"
              value={walletId}
              onChange={setWalletId}
              placeholder="Pilih dompet"
              options={wallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))}
            />
          </div>

          <div className="block">
            <span className="text-sm font-semibold text-muted">Kategori</span>
            <SelectMenu
              ariaLabel="Kategori"
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Tanpa kategori"
              options={[{ value: "", label: "Tanpa kategori" }, ...expenseCategories.map((category) => ({ value: category.id, label: category.name }))]}
            />
          </div>

          <div className="block">
            <span className="text-sm font-semibold text-muted">Frekuensi</span>
            <SelectMenu
              ariaLabel="Frekuensi"
              value={frequency}
              onChange={(value) => setFrequency(value as Reminder["frequency"])}
              options={[
                { value: "monthly", label: "Setiap bulan" },
                { value: "weekly", label: "Setiap minggu" },
                { value: "yearly", label: "Setiap tahun" },
                { value: "daily", label: "Setiap hari" }
              ]}
            />
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-muted">Jatuh tempo berikutnya</span>
            <input type="date" className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>

          <div className="block">
            <span className="text-sm font-semibold text-muted">Ingatkan mulai</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {[1, 3, 5].map((days) => (
                <button
                  key={days}
                  type="button"
                  className={`min-h-10 rounded-full px-4 text-sm font-semibold ${remindDays === days ? "bg-primary text-white" : "bg-surface-container text-muted"}`}
                  onClick={() => setRemindDays(days)}
                >
                  H-{days}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">Pengingat muncul mulai H-{remindDays}, lalu H-3 dan H-1.</p>
          </div>

          {error ? <p className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p> : null}
        </div>
        </div>

        {/* Fixed footer — always visible, clears mobile safe-area */}
        <div className="shrink-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3">
          <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98] disabled:opacity-60" disabled={busy} type="submit">
            {busy ? "Menyimpan..." : "Simpan Pengingat"}
          </button>
        </div>
      </form>
    </div>
  );
}
