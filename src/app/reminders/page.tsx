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
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  next_run_at: string;
  remind_days_before: number;
  days_until: number;
  status: "overdue" | "due_today" | "due_soon" | "upcoming" | "scheduled";
  paid_for_current_period: boolean;
};

type WalletOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; type: "expense" | "income" | "transfer" };
type MerchantOption = { id: string; name: string; category_id: string | null };

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

// Legacy demo content removed; the page is now data-driven.
function _LegacyShim() {
  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-xl bg-surface p-5 shadow-card">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-error-container text-on-error-container">
            <span className="font-bold">N</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Netflix</h2>
            <p className="text-sm text-muted">Jatuh tempo: 01 Juni</p>
          </div>
          <div className="text-right">
            <p className="font-bold">{displayAmount("Rp 186.000")}</p>
            <span className="mt-1 inline-flex rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-white">AKTIF</span>
          </div>
        </div>
        <div className="space-y-4 border-t border-surface-container pt-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-muted">Periode Notifikasi</p>
            <div className="flex flex-wrap gap-2">
              {["7 hari sebelum", "3 hari sebelum", "1 hari sebelum"].map((item, index) => (
                <button className={`min-h-10 rounded-full px-4 text-sm font-semibold ${index === 1 ? "bg-primary text-white" : "bg-surface-container text-muted"}`} key={item} type="button">
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-surface-low p-3">
            <Repeat className="text-primary" size={20} />
            <span className="font-semibold">Setiap bulan</span>
          </div>
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-sm font-bold text-muted">LANGGANAN LAINNYA</h3>
        <div className="space-y-3">
          {subscriptions.map((item) => (
            <article className={`flex items-center justify-between rounded-xl bg-surface p-4 shadow-card ${item.tone === "warning" ? "border-2 border-dashed border-warning" : ""}`} key={item.name}>
              <div className="flex items-center gap-3">
                <div className={`flex size-10 items-center justify-center rounded-full ${item.tone === "warning" ? "bg-surface-container text-warning" : "bg-income/10 text-income"}`}>
                  {item.tone === "warning" ? <ShieldAlert size={18} /> : <Bell size={18} />}
                </div>
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className={`text-sm ${item.tone === "warning" ? "text-warning" : "text-muted"}`}>{item.date}</p>
                </div>
              </div>
              <p className="font-semibold">{displayAmount(item.amount)}</p>
            </article>
          ))}
        </div>
      </section>
      <button className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-white shadow-card active:scale-[0.98]" type="button">
        <Plus size={20} />
        Tambah Pengingat Baru
      </button>
    </div>
  );
}
