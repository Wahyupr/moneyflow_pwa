"use client";

import { ArrowLeft, Pencil, ReceiptText, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { SelectMenu } from "@/components/ui/select-menu";
import { AppFrame } from "@/components/app-frame";
import { usePrivacy } from "@/components/privacy-provider";
import { formatCurrency } from "@/lib/money";

type Transaction = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  merchant_name: string | null;
  payment_method: string | null;
  transaction_type: "expense" | "income" | "transfer";
  amount_minor: number;
  currency: string;
  occurred_at: string;
  note: string | null;
  input_method: string | null;
  receipt_image_data_url: string | null;
};

type WalletOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; type: string };

export default function TransactionDetailPage() {
  return (
    <AppFrame title="Detail Transaksi" subtitle="Riwayat">
      <DetailContent />
    </AppFrame>
  );
}

function DetailContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { displayAmount } = usePrivacy();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [txRes, walletsRes, categoriesRes] = await Promise.all([
          fetch(`/api/transactions/${id}`),
          fetch("/api/wallets"),
          fetch("/api/categories")
        ]);
        const payload = await txRes.json().catch(() => null);
        if (cancelled) return;
        if (!txRes.ok) { setError(payload?.error ?? "Transaksi tidak ditemukan."); return; }
        setTx(payload.transaction as Transaction);
        if (walletsRes.ok) setWallets(((await walletsRes.json()).wallets ?? []) as WalletOption[]);
        if (categoriesRes.ok) setCategories(((await categoriesRes.json()).categories ?? []) as CategoryOption[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function handleDelete() {
    if (!tx || !window.confirm("Hapus transaksi ini? Aksi tidak bisa dibatalkan.")) return;
    const res = await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
    if (res.ok) { router.refresh(); router.push("/transactions"); }
    else { const d = await res.json().catch(() => null); setError(d?.error ?? "Gagal menghapus."); }
  }

  if (loading) {
    return <p className="mt-8 text-center text-sm text-muted">Memuat...</p>;
  }
  if (error || !tx) {
    return (
      <div className="mt-8 space-y-3 text-center">
        <p className="text-sm font-semibold text-error">{error ?? "Transaksi tidak ditemukan."}</p>
        <Link href="/transactions" className="inline-flex items-center gap-1 text-sm font-bold text-primary">
          <ArrowLeft size={14} /> Kembali
        </Link>
      </div>
    );
  }

  const amountTone =
    tx.transaction_type === "income" ? "text-income" : tx.transaction_type === "expense" ? "text-expense" : "text-transfer";

  return (
    <div className="mt-5 space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <Link href="/transactions" className="inline-flex items-center gap-1 text-sm font-bold text-primary">
          <ArrowLeft size={16} /> Kembali
        </Link>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowEdit(true)} className="flex items-center gap-1 rounded-lg bg-surface-container px-3 py-2 text-sm font-bold text-primary active:scale-[0.98]">
            <Pencil size={15} /> Edit
          </button>
          <button type="button" onClick={handleDelete} className="flex items-center gap-1 rounded-lg bg-error-container px-3 py-2 text-sm font-bold text-expense active:scale-[0.98]">
            <Trash2 size={15} /> Hapus
          </button>
        </div>
      </div>

      {showEdit ? (
        <EditSheet tx={tx} wallets={wallets} categories={categories} onClose={() => setShowEdit(false)}
          onSaved={(updated: Transaction) => { setTx(updated); setShowEdit(false); }} />
      ) : null}

      <section className="rounded-xl bg-surface p-5 text-center shadow-card">
        <p className="text-sm text-muted">
          {tx.transaction_type === "income" ? "Pemasukan" : tx.transaction_type === "expense" ? "Pengeluaran" : "Transfer"}
        </p>
        <p className={`mt-1 text-3xl font-extrabold tabular-nums ${amountTone}`}>
          {displayAmount(formatCurrency(tx.amount_minor, "IDR"))}
        </p>
        {tx.merchant_name ? <p className="mt-2 text-base font-semibold text-ink">{tx.merchant_name}</p> : null}
        <p className="mt-1 text-xs text-muted">{new Date(tx.occurred_at).toLocaleString("id-ID")}</p>
      </section>

      <section className="rounded-xl bg-surface p-4 shadow-card">
        <h3 className="mb-2 font-bold text-ink">Detail</h3>
        <dl className="space-y-1.5 text-sm">
          {tx.payment_method ? <DetailRow label="Metode bayar" value={tx.payment_method} /> : null}
          {tx.input_method ? <DetailRow label="Sumber input" value={inputMethodLabel(tx.input_method)} /> : null}
          {tx.note ? <DetailRow label="Catatan" value={tx.note} /> : null}
        </dl>
      </section>

      {tx.receipt_image_data_url ? (
        <section className="overflow-hidden rounded-xl bg-surface shadow-card">
          <div className="flex items-center gap-2 border-b border-outline/50 p-4">
            <ReceiptText className="text-primary" size={18} />
            <h3 className="font-bold text-ink">Bukti Struk</h3>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <a href={tx.receipt_image_data_url} target="_blank" rel="noopener noreferrer">
            <img alt="Bukti struk" src={tx.receipt_image_data_url} className="w-full object-contain" />
          </a>
          <p className="px-4 py-2 text-center text-xs text-muted">Tap gambar untuk lihat ukuran penuh</p>
        </section>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

function EditSheet({
  tx,
  wallets,
  categories,
  onClose,
  onSaved
}: {
  tx: Transaction;
  wallets: WalletOption[];
  categories: CategoryOption[];
  onClose: () => void;
  onSaved: (updated: Transaction) => void;
}) {
  const [amount, setAmount] = useState(String(tx.amount_minor));
  const [type, setType] = useState(tx.transaction_type);
  const [merchantName, setMerchantName] = useState(tx.merchant_name ?? "");
  const [walletId, setWalletId] = useState(tx.wallet_id);
  const [categoryId, setCategoryId] = useState(tx.category_id ?? "");
  const [note, setNote] = useState(tx.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleCategories = categories.filter((c) => c.type === type || c.type === "transfer");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const amountMinor = Math.round(Number(amount));
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) { setError("Nominal harus lebih dari 0."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transaction_type: type,
          amount_minor: amountMinor,
          merchant_name: merchantName.trim() || null,
          wallet_id: walletId,
          category_id: categoryId || null,
          note: note.trim() || null
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? "Gagal menyimpan."); return; }
      const updated = data.transaction as Record<string, unknown>;
      onSaved({
        ...tx,
        ...updated,
        amount_minor: Number(updated.amount_minor),
        occurred_at: updated.occurred_at instanceof Date
          ? (updated.occurred_at as Date).toISOString()
          : String(updated.occurred_at)
      } as Transaction);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="flex w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-lift sm:rounded-2xl" style={{ maxHeight: "min(90dvh, calc(100dvh - env(safe-area-inset-bottom, 0px)))" }}>
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
          <h3 className="text-lg font-bold text-ink">Edit Transaksi</h3>
          <button type="button" onClick={onClose} className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-container" aria-label="Tutup">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          <div className="space-y-3">
            <div>
              <span className="text-sm font-semibold text-muted">Tipe</span>
              <SelectMenu ariaLabel="Tipe" value={type} onChange={(v) => { setType(v as Transaction["transaction_type"]); setCategoryId(""); }}
                options={[{ value: "expense", label: "Pengeluaran" }, { value: "income", label: "Pemasukan" }, { value: "transfer", label: "Transfer" }]} />
            </div>
            <label className="block">
              <span className="text-sm font-semibold text-muted">Nominal (Rp)</span>
              <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-muted">Merchant</span>
              <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} placeholder="Nama merchant" />
            </label>
            <div>
              <span className="text-sm font-semibold text-muted">Dompet</span>
              <SelectMenu ariaLabel="Dompet" value={walletId} onChange={setWalletId} placeholder="Pilih dompet"
                options={wallets.map((w) => ({ value: w.id, label: w.name }))} />
            </div>
            <div>
              <span className="text-sm font-semibold text-muted">Kategori</span>
              <SelectMenu ariaLabel="Kategori" value={categoryId} onChange={setCategoryId} placeholder="Tanpa kategori"
                options={[{ value: "", label: "Tanpa kategori" }, ...visibleCategories.map((c) => ({ value: c.id, label: c.name }))]} />
            </div>
            <label className="block">
              <span className="text-sm font-semibold text-muted">Catatan</span>
              <input className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsional" />
            </label>
            {error ? <p className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p> : null}
          </div>
        </div>
        <div className="shrink-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3">
          <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98] disabled:opacity-60">
            {busy ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}

function inputMethodLabel(value: string): string {
  switch (value) {
    case "voice":
      return "Suara";
    case "receipt_scan":
      return "Scan Struk";
    case "manual":
      return "Manual";
    default:
      return value;
  }
}
