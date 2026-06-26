"use client";

import { Save, Store } from "lucide-react";
import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { SelectMenu } from "@/components/ui/select-menu";
import { getCategoryIcon } from "@/lib/category-icons";

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
    const amountvalue = Math.round(Number(amount));
    if (!Number.isFinite(amountvalue) || amountvalue <= 0) {
      setError("Nominal harus lebih dari 0.");
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
          occurred_at: new Date().toISOString(),
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
    return <p className="mt-5 rounded-xl bg-surface p-5 text-center text-sm text-muted shadow-card">Memuat data...</p>;
  }

  if (wallets.length === 0) {
    return (
      <div className="mt-5 rounded-xl bg-surface p-6 text-center shadow-card">
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

  return (
    <div className="mt-5 space-y-4 rounded-xl bg-surface p-4 shadow-card">
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

      <Field label="Nominal (Rp)" placeholder="50000" inputMode="numeric" value={amount} onChange={setAmount} />

      <div className="block">
        <span className="text-sm font-semibold text-muted">Tipe</span>
        <SelectMenu
          ariaLabel="Tipe transaksi"
          value={type}
          onChange={(value) => {
            setType(value as TransactionType);
            setCategoryId("");
          }}
          options={[
            { value: "expense", label: "Pengeluaran" },
            { value: "income", label: "Pemasukan" }
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

      <Field label="Catatan" placeholder="Opsional" value={note} onChange={setNote} />

      {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}

      <button
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98] disabled:opacity-60"
        type="button"
        onClick={submit}
        disabled={saving}
      >
        <Save size={18} />
        {saving ? "Menyimpan..." : "Simpan Transaksi"}
      </button>
    </div>
  );
}

function Field({
  label,
  placeholder,
  inputMode,
  value,
  onChange
}: {
  label: string;
  placeholder: string;
  inputMode?: "numeric";
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <input
        className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 text-ink placeholder:text-muted focus:border-primary focus:outline-none"
        placeholder={placeholder}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
