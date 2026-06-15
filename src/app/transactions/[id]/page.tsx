"use client";

import { ArrowLeft, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
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
  const { displayAmount } = usePrivacy();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/transactions/${id}`);
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) {
          setError(payload?.error ?? "Transaksi tidak ditemukan.");
          return;
        }
        setTx(payload.transaction as Transaction);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
      <Link href="/transactions" className="inline-flex items-center gap-1 text-sm font-bold text-primary">
        <ArrowLeft size={16} /> Kembali
      </Link>

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
