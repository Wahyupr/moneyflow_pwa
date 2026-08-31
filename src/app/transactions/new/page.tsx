"use client";

import { Calendar, FileText, Landmark, Save, Store } from "lucide-react";

import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { SelectMenu } from "@/components/ui/select-menu";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatThousands, parseThousands } from "@/lib/money";

type TransactionType = "expense" | "income";

type WalletOption = {
  id: string;
  name: string;
  type: string;
  currency: string;
};

type CategoryOption = {
  id: string;
  name: string;
  type: "expense" | "income" | "transfer";
  icon: string | null;
};

type MerchantOption = {
  id: string;
  name: string;
  logo_url: string | null;
};

/** Returns today's date as YYYY-MM-DD in the local timezone (input[type=date] format). */
function todayDateInput(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Current time as HH:MM (input[type=time] format). */
function nowTimeInput(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export default function NewTransactionPage() {
  return (
    <AppFrame title="Catat Manual" subtitle="Tambah transaksi">
      <NewTransactionForm />
    </AppFrame>
  );
}

function MerchantLogo({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className="size-5 rounded-full object-contain" />;
  }
  return <Store size={16} />;
}

function NewTransactionForm() {
  const router = useRouter();
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayDateInput());
  const [time, setTime] = useState(nowTimeInput());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [walletsRes, categoriesRes, merchantsRes] = await Promise.all([
        fetch("/api/wallets"),
        fetch("/api/categories"),
        fetch("/api/merchants")
      ]);

      const walletList: WalletOption[] = walletsRes.ok ? (await walletsRes.json()).wallets ?? [] : [];
      const categoryList: CategoryOption[] = categoriesRes.ok ? (await categoriesRes.json()).categories ?? [] : [];
      const merchantList: MerchantOption[] = merchantsRes.ok ? (await merchantsRes.json()).merchants ?? [] : [];

      setWallets(walletList);
      setCategories(categoryList);
      setMerchants(merchantList);
      if (walletList.length > 0) {
        setWalletId((current) => current || walletList[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Only show categories matching the selected transaction type.
  const visibleCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type]
  );

  async function submit() {
    setError(null);

    if (!walletId) {
      setError("Pilih dompet terlebih dahulu.");
      return;
    }
    const amountvalue = Math.round(Number(parseThousands(amount)));
    if (!Number.isFinite(amountvalue) || amountvalue <= 0) {
      setError("Nominal harus lebih dari 0.");
      return;
    }
    if (!date) {
      setError("Tanggal transaksi wajib diisi.");
      return;
    }

    // Combine the date + time inputs into a real Date so occurred_at reflects
    // what the user picked instead of always defaulting to "now".
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = (time || "00:00").split(":").map(Number);
    const occurredAt = new Date(year, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);
    if (Number.isNaN(occurredAt.getTime())) {
      setError("Tanggal atau waktu tidak valid.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet_id: walletId,
          category_id: categoryId ? categoryId : null,
          transaction_type: type,
          amount_minor: amountvalue,
          currency: "IDR",
          occurred_at: occurredAt.toISOString(),
          merchant_name: merchantName.trim() ? merchantName.trim() : null,
          note: note.trim() ? note.trim() : null,
          input_method: "manual"
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ?? "Gagal menyimpan transaksi.");
        return;
      }

      router.refresh();
      router.push("/transactions");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-5 animate-pulse space-y-4">
        <div className="h-40 rounded-2xl bg-surface shadow-card" />
        <div className="h-56 rounded-2xl bg-surface shadow-card" />
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="mt-5 rounded-2xl bg-surface p-6 text-center shadow-card">
        <p className="font-semibold text-ink">Belum ada dompet</p>
        <p className="mt-1 text-sm text-muted">Tambahkan dompet dulu sebelum mencatat transaksi.</p>
        <button
          className="mt-3 min-h-10 rounded-lg bg-primary px-4 text-sm font-bold text-white active:scale-[0.98]"
          onClick={() => router.push("/wallets")}
          type="button"
        >
          Ke Dompet
        </button>
      </div>
    );
  }

  const isIncome = type === "income";

  return (
    <div className="mt-5 space-y-4 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-5 lg:space-y-0">
      {/* ── Left column: amount hero, type toggle, date/time ── */}
      <div className="space-y-4">
        <section
          className={`rounded-2xl p-6 text-center shadow-card transition-colors ${
            isIncome ? "bg-income/10" : "bg-expense/10"
          }`}
        >
          <div className="mb-4 flex justify-center gap-2 rounded-full bg-surface p-1 shadow-card">
            <button
              type="button"
              onClick={() => {
                setType("expense");
                setCategoryId("");
              }}
              className={`min-h-10 flex-1 rounded-full px-4 text-sm font-bold transition ${
                !isIncome ? "bg-expense text-white shadow-card" : "text-muted"
              }`}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => {
                setType("income");
                setCategoryId("");
              }}
              className={`min-h-10 flex-1 rounded-full px-4 text-sm font-bold transition ${
                isIncome ? "bg-income text-white shadow-card" : "text-muted"
              }`}
            >
              Pemasukan
            </button>
          </div>

          <label className="block">
            <span className="sr-only">Nominal</span>
            <div className="flex items-center justify-center gap-1">
              <span className={`text-2xl font-bold ${isIncome ? "text-income" : "text-expense"}`}>Rp</span>
              <input
                className={`w-full min-w-0 bg-transparent text-center text-4xl font-extrabold tabular-nums placeholder:text-muted/40 focus:outline-none sm:text-5xl ${
                  isIncome ? "text-income" : "text-expense"
                }`}
                placeholder="0"
                inputMode="numeric"
                value={formatThousands(amount)}
                onChange={(event) => setAmount(parseThousands(event.target.value).replace(/\D/g, ""))}
                aria-label="Nominal (Rp)"
              />
            </div>
          </label>
        </section>

        <section className="rounded-2xl bg-surface p-4 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <Calendar size={16} className="text-primary" />
            Tanggal &amp; Waktu
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-muted">Tanggal</span>
              <input
                type="date"
                className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 text-ink focus:border-primary focus:outline-none"
                value={date}
                max={todayDateInput()}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted">Waktu</span>
              <input
                type="time"
                className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 text-ink focus:border-primary focus:outline-none"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
          </div>
        </section>

        {error ? (
          <p className="rounded-lg bg-error-container p-3 text-sm font-semibold text-on-error-container">{error}</p>
        ) : null}


        <button
          className="hidden min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white transition active:scale-[0.98] disabled:opacity-60 lg:flex"
          type="button"
          onClick={submit}
          disabled={saving}
        >
          <Save size={18} />
          {saving ? "Menyimpan..." : "Simpan Transaksi"}
        </button>
      </div>

      {/* ── Right column: merchant, wallet, category, note ── */}
      <div className="space-y-4">
        <section className="space-y-4 rounded-2xl bg-surface p-4 shadow-card">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Landmark size={16} className="text-primary" />
            Detail Transaksi
          </h2>

          <div className="block">
            <span className="text-sm font-semibold text-muted">Merchant</span>
            <SelectMenu
              ariaLabel="Merchant"
              value={merchantName}
              onChange={setMerchantName}
              placeholder={merchants.length > 0 ? "Pilih merchant" : "Belum ada merchant"}
              options={[
                { value: "", label: "Tanpa merchant" },
                ...merchants.map((merchant) => ({
                  value: merchant.name,
                  label: merchant.name,
                  icon: <MerchantLogo logoUrl={merchant.logo_url} />
                }))
              ]}
            />
          </div>

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
              placeholder={visibleCategories.length > 0 ? "Tanpa kategori" : "Belum ada kategori"}
              options={[
                { value: "", label: "Tanpa kategori" },
                ...visibleCategories.map((category) => ({
                  value: category.id,
                  label: category.name,
                  icon: createElement(getCategoryIcon(category.icon), { size: 16 })
                }))
              ]}
            />
          </div>
        </section>

        <section className="rounded-2xl bg-surface p-4 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <FileText size={16} className="text-primary" />
            Catatan
          </h2>
          <label className="block">
            <span className="sr-only">Catatan</span>
            <input
              className="min-h-12 w-full rounded-lg border border-outline bg-surface px-3 text-ink placeholder:text-muted focus:border-primary focus:outline-none"
              placeholder="Opsional, mis. keterangan tambahan"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </section>

        {/* Mobile-only sticky save button, sits above the bottom nav bar. */}
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-40 px-4 lg:hidden">
          <button
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white shadow-lift transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            onClick={submit}
            disabled={saving}
          >
            <Save size={18} />
            {saving ? "Menyimpan..." : "Simpan Transaksi"}
          </button>
        </div>
        {/* Spacer so content isn't hidden behind the fixed mobile button. */}
        <div className="h-16 lg:hidden" aria-hidden="true" />
      </div>
    </div>
  );
}



