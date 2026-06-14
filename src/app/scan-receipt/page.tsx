"use client";

import { Camera, Check, ReceiptText, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { formatCurrency } from "@/lib/money";

type ReceiptPreview = {
  transaction_type: "expense" | "income";
  amount_minor: number;
  merchant_name: string | null;
  payment_method: string | null;
  occurred_at: string | null;
  wallet_id: string | null;
  wallet_name: string | null;
  category_id: string | null;
  category_name: string | null;
};

const MAX_BYTES = 6 * 1024 * 1024;

export default function ScanReceiptPage() {
  return (
    <AppFrame title="Scan Struk" subtitle="Tambah transaksi">
      <ScanReceiptContent />
    </AppFrame>
  );
}

function ScanReceiptContent() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");
  const [preview, setPreview] = useState<ReceiptPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile() {
    fileRef.current?.click();
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setError(null);
    setPreview(null);
    if (file.size > MAX_BYTES) {
      setError("Ukuran gambar maksimal 6MB.");
      return;
    }
    const type = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
    setMediaType(type);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setImageData(dataUrl);
      // Strip the "data:<type>;base64," prefix for the API.
      setBase64(dataUrl.split(",")[1] ?? null);
    };
    reader.readAsDataURL(file);
  }

  async function scan() {
    if (!base64) {
      setError("Pilih atau foto struk dulu.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/receipt-transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image_base64: base64, media_type: mediaType, commit: false })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Gagal membaca struk.");
        return;
      }
      setPreview(payload.preview as ReceiptPreview);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!base64) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/receipt-transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image_base64: base64, media_type: mediaType })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Gagal menyimpan transaksi.");
        return;
      }
      router.push("/transactions");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setImageData(null);
    setBase64(null);
    setPreview(null);
    setError(null);
  }

  return (
    <div className="mt-5 space-y-4">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />

      {!imageData ? (
        <button
          className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-outline bg-surface p-10 text-center active:scale-[0.99]"
          onClick={pickFile}
          type="button"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-surface-container text-primary">
            <Camera size={26} />
          </span>
          <span className="font-bold text-ink">Foto / Pilih Struk</span>
          <span className="text-sm text-muted">Struk belanja, QRIS, atau bukti transfer</span>
        </button>
      ) : (
        <div className="overflow-hidden rounded-xl bg-surface shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Pratinjau struk" className="max-h-72 w-full object-contain" src={imageData} />
          <button className="flex w-full items-center justify-center gap-2 p-3 text-sm font-bold text-primary active:bg-surface-container" onClick={reset} type="button">
            <RotateCcw size={16} />
            Ganti gambar
          </button>
        </div>
      )}

      {preview ? (
        <div className="rounded-xl border border-outline bg-surface p-4 shadow-card">
          <div className="flex items-center gap-2">
            <ReceiptText className="text-primary" size={18} />
            <h3 className="font-bold text-ink">Hasil scan</h3>
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="Nominal" value={formatCurrency(preview.amount_minor, "IDR")} />
            <Row label="Tipe" value={preview.transaction_type === "income" ? "Pemasukan" : "Pengeluaran"} />
            <Row label="Merchant" value={preview.merchant_name ?? "-"} />
            <Row label="Dompet" value={preview.wallet_name ?? "Tidak ditemukan"} />
            <Row label="Kategori" value={preview.category_name ?? "Tanpa kategori"} />
            {preview.occurred_at ? <Row label="Tanggal" value={new Date(preview.occurred_at).toLocaleString("id-ID")} /> : null}
          </dl>
        </div>
      ) : null}

      {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}

      {preview ? (
        <div className="flex gap-2">
          <button className="min-h-12 flex-1 rounded-lg bg-surface-container px-4 font-bold text-primary active:scale-[0.98]" onClick={() => setPreview(null)} type="button" disabled={busy}>
            Ulangi
          </button>
          <button className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98] disabled:opacity-60" onClick={save} type="button" disabled={busy}>
            <Check size={18} />
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      ) : (
        <button
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98] disabled:opacity-60"
          onClick={scan}
          type="button"
          disabled={busy || !base64}
        >
          {busy ? "Membaca struk..." : "Scan Struk"}
        </button>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-semibold text-ink">{value}</dd>
    </div>
  );
}
