"use client";

import { Camera, Check, ImageIcon, ReceiptText, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { SelectMenu } from "@/components/ui/select-menu";
import { formatCurrency } from "@/lib/money";

type WalletOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; type: "expense" | "income" | "transfer" };
type MerchantOption = { id: string; name: string; category_id: string | null; is_system: boolean };

type ReceiptItem = {
  name: string;
  quantity: string | null;
  unit_price: number | null;
  amount: number | null;
};

type ReceiptDetail = {
  items: ReceiptItem[];
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  service_fee: number | null;
  total_amount: number | null;
  currency: string | null;
  notes: string | null;
};

type ReceiptForm = {
  transaction_type: "expense" | "income";
  amount: string;
  merchant_name: string;
  wallet_id: string;
  category_id: string;
  payment_method: string;
  occurred_at: string | null;
};

const MAX_BYTES = 6 * 1024 * 1024;
const ADD_MERCHANT = "__add__";

/**
 * Compress an image to a JPEG data URL we can store on the transaction. We
 * downscale so the longest side ≤ 1024px and re-encode at quality 0.7. This
 * keeps the receipt photo legible while dropping size from megabytes to a few
 * hundred KB so it fits comfortably in a single TEXT column.
 */
async function compressImageDataUrl(originalDataUrl: string, maxSide = 1024, quality = 0.7): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Gagal memuat gambar."));
    img.src = originalDataUrl;
  });

  const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return originalDataUrl;
  }
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}


export default function ScanReceiptPage() {
  return (
    <AppFrame title="Scan Struk" subtitle="Tambah transaksi">
      <ScanReceiptContent />
    </AppFrame>
  );
}

function ScanReceiptContent() {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");

  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);

  const [form, setForm] = useState<ReceiptForm | null>(null);
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
  const [addingMerchant, setAddingMerchant] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Categories filtered to the selected transaction type.
  const visibleCategories = useMemo(
    () => (form ? categories.filter((category) => category.type === form.transaction_type) : []),
    [categories, form]
  );

  const loadMasters = useCallback(async () => {
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
    return { walletList, merchantList };
  }, []);

  function pickCamera() {
    cameraRef.current?.click();
  }

  function pickGallery() {
    galleryRef.current?.click();
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setError(null);
    setForm(null);
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
      const [{ walletList }, response] = await Promise.all([
        loadMasters(),
        fetch("/api/receipt-transactions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image_base64: base64, media_type: mediaType, commit: false })
        })
      ]);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Gagal membaca struk.");
        return;
      }
      const preview = payload.preview as {
        transaction_type: "expense" | "income";
        amount_minor: number;
        merchant_name: string | null;
        payment_method: string | null;
        occurred_at: string | null;
        wallet_id: string | null;
        category_id: string | null;
        items?: ReceiptItem[];
        subtotal?: number | null;
        tax?: number | null;
        discount?: number | null;
        service_fee?: number | null;
        total_amount?: number | null;
        currency?: string | null;
        notes?: string | null;
      };
      setForm({
        transaction_type: preview.transaction_type,
        amount: String(preview.amount_minor || ""),
        merchant_name: preview.merchant_name ?? "",
        wallet_id: preview.wallet_id ?? walletList[0]?.id ?? "",
        category_id: preview.category_id ?? "",
        payment_method: preview.payment_method ?? "",
        occurred_at: preview.occurred_at
      });
      setDetail({
        items: preview.items ?? [],
        subtotal: preview.subtotal ?? null,
        tax: preview.tax ?? null,
        discount: preview.discount ?? null,
        service_fee: preview.service_fee ?? null,
        total_amount: preview.total_amount ?? null,
        currency: preview.currency ?? null,
        notes: preview.notes ?? null
      });
      setAddingMerchant(false);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setImageData(null);
    setBase64(null);
    setForm(null);
    setDetail(null);
    setError(null);
    setAddingMerchant(false);
  }

  async function save() {
    if (!form) {
      return;
    }
    const amount = Math.round(Number(form.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Nominal harus lebih dari 0.");
      return;
    }
    if (!form.wallet_id) {
      setError("Pilih dompet dulu.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // Persist a new personal merchant if the typed name isn't known yet, so
      // it (and its category) is reusable next time.
      await ensureMerchant(form);

      // Compress the original photo so we can store it on the transaction as a
      // small data URL (proof for later viewing). Best-effort: if compression
      // fails the transaction still saves without the receipt image.
      let receiptImageDataUrl: string | undefined;
      if (imageData) {
        try {
          receiptImageDataUrl = await compressImageDataUrl(imageData);
        } catch {
          receiptImageDataUrl = undefined;
        }
      }

      const response = await fetch("/api/receipt-transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commit: true,
          transaction_type: form.transaction_type,
          amount_minor: amount,
          merchant_name: form.merchant_name.trim() ? form.merchant_name.trim() : null,
          wallet_id: form.wallet_id,
          category_id: form.category_id ? form.category_id : null,
          payment_method: form.payment_method.trim() ? form.payment_method.trim() : null,
          occurred_at: form.occurred_at ?? undefined,
          receipt_image_data_url: receiptImageDataUrl
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Gagal menyimpan transaksi.");
        return;
      }
      // Invalidate the Next.js router cache so /transactions shows the new row.
      router.refresh();
      router.push("/transactions");
    } finally {
      setBusy(false);
    }
  }

  // Creates a personal merchant when the typed name is new (so it's saved to the
  // user's directory with its chosen category).
  async function ensureMerchant(current: ReceiptForm) {
    const name = current.merchant_name.trim();
    if (!name) {
      return;
    }
    const exists = merchants.some((merchant) => merchant.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      return;
    }
    await fetch("/api/merchants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, category_id: current.category_id || null })
    }).catch(() => null);
  }

  return (
    <div className="mt-5 space-y-4">
      {/* Camera input — opens camera directly on mobile */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
      {/* Gallery input — opens file picker / gallery */}
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {!imageData ? (
        <div className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-outline bg-surface p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-surface-container text-primary">
            <Camera size={26} />
          </span>
          <span className="font-bold text-ink">Pilih Sumber Gambar</span>
          <span className="text-sm text-muted">Struk belanja, QRIS, atau bukti transfer</span>
          <div className="mt-1 flex w-full gap-2">
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white active:scale-[0.98]"
              onClick={pickCamera}
              type="button"
            >
              <Camera size={18} />
              Kamera
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-surface-container px-4 py-3 text-sm font-bold text-ink active:scale-[0.98]"
              onClick={pickGallery}
              type="button"
            >
              <ImageIcon size={18} />
              Galeri
            </button>
          </div>
        </div>
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

      {form ? (
        <div className="rounded-xl border border-outline bg-surface p-4 shadow-card">
          <div className="flex items-center gap-2">
            <ReceiptText className="text-primary" size={18} />
            <h3 className="font-bold text-ink">Hasil scan (bisa diubah)</h3>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-sm font-semibold text-muted">Nominal (Rp)</span>
              <input
                className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
                inputMode="numeric"
                value={form.amount}
                onChange={(event) => setForm((current) => (current ? { ...current, amount: event.target.value } : current))}
              />
            </label>

            <div className="block">
              <span className="text-sm font-semibold text-muted">Tipe</span>
              <SelectMenu
                ariaLabel="Tipe transaksi"
                value={form.transaction_type}
                onChange={(value) =>
                  setForm((current) => (current ? { ...current, transaction_type: value as "expense" | "income", category_id: "" } : current))
                }
                options={[
                  { value: "expense", label: "Pengeluaran" },
                  { value: "income", label: "Pemasukan" }
                ]}
              />
            </div>

            <div className="block">
              <span className="text-sm font-semibold text-muted">Merchant</span>
              {addingMerchant ? (
                <div className="mt-2 space-y-2">
                  <input
                    className="min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
                    placeholder="Nama merchant"
                    value={form.merchant_name}
                    onChange={(event) => setForm((current) => (current ? { ...current, merchant_name: event.target.value } : current))}
                  />
                  <button className="text-sm font-bold text-primary" type="button" onClick={() => setAddingMerchant(false)}>
                    Pilih dari daftar
                  </button>
                </div>
              ) : (
                <SelectMenu
                  ariaLabel="Merchant"
                  value={merchants.some((merchant) => merchant.name === form.merchant_name) ? form.merchant_name : ""}
                  onChange={(value) => {
                    if (value === ADD_MERCHANT) {
                      setAddingMerchant(true);
                      setForm((current) => (current ? { ...current, merchant_name: "" } : current));
                      return;
                    }
                    const picked = merchants.find((merchant) => merchant.name === value);
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            merchant_name: value,
                            // Adopt the merchant's category if it has one.
                            category_id: picked?.category_id ?? current.category_id
                          }
                        : current
                    );
                  }}
                  placeholder="Pilih merchant"
                  options={[
                    ...merchants.map((merchant) => ({ value: merchant.name, label: merchant.name })),
                    { value: ADD_MERCHANT, label: "+ Tambah merchant baru" }
                  ]}
                />
              )}
            </div>

            <div className="block">
              <span className="text-sm font-semibold text-muted">Dompet</span>
              <SelectMenu
                ariaLabel="Dompet"
                value={form.wallet_id}
                onChange={(value) => setForm((current) => (current ? { ...current, wallet_id: value } : current))}
                placeholder="Pilih dompet"
                options={wallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))}
              />
            </div>

            <div className="block">
              <span className="text-sm font-semibold text-muted">Kategori</span>
              <SelectMenu
                ariaLabel="Kategori"
                value={form.category_id}
                onChange={(value) => setForm((current) => (current ? { ...current, category_id: value } : current))}
                placeholder="Tanpa kategori"
                options={[
                  { value: "", label: "Tanpa kategori" },
                  ...visibleCategories.map((category) => ({ value: category.id, label: category.name }))
                ]}
              />
            </div>

            {form.occurred_at ? (
              <p className="text-xs text-muted">Tanggal struk: {new Date(form.occurred_at).toLocaleString("id-ID")}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {detail && (detail.items.length > 0 || detail.subtotal != null || detail.tax != null || detail.discount != null || detail.service_fee != null || detail.notes) ? (
        <div className="rounded-xl border border-outline bg-surface p-4 shadow-card">
          <h3 className="font-bold text-ink">Detail Struk</h3>

          {detail.items.length > 0 ? (
            <ul className="mt-3 divide-y divide-outline/50">
              {detail.items.map((item, idx) => (
                <li key={`${item.name}-${idx}`} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{item.name}</p>
                    {item.quantity ? <p className="text-xs text-muted">Qty: {item.quantity}{item.unit_price ? ` × ${formatCurrency(item.unit_price, "IDR")}` : ""}</p> : null}
                  </div>
                  {item.amount != null ? <span className="shrink-0 font-semibold text-ink">{formatCurrency(item.amount, "IDR")}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}

          {(detail.subtotal != null || detail.tax != null || detail.discount != null || detail.service_fee != null) ? (
            <dl className="mt-3 space-y-1 border-t border-outline/50 pt-3 text-sm">
              {detail.subtotal != null ? <BreakdownRow label="Subtotal" value={formatCurrency(detail.subtotal, "IDR")} /> : null}
              {detail.discount != null && detail.discount !== 0 ? <BreakdownRow label="Diskon" value={`- ${formatCurrency(Math.abs(detail.discount), "IDR")}`} /> : null}
              {detail.tax != null && detail.tax !== 0 ? <BreakdownRow label="Pajak" value={formatCurrency(detail.tax, "IDR")} /> : null}
              {detail.service_fee != null && detail.service_fee !== 0 ? <BreakdownRow label="Biaya Layanan" value={formatCurrency(detail.service_fee, "IDR")} /> : null}
              {detail.total_amount != null ? (
                <div className="flex items-center justify-between pt-1 text-base font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(detail.total_amount, "IDR")}</span>
                </div>
              ) : null}
            </dl>
          ) : null}

          {detail.notes ? <p className="mt-3 text-xs italic text-muted">{detail.notes}</p> : null}
        </div>
      ) : null}

      {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}

      {form ? (
        <div className="flex gap-2">
          <button className="min-h-12 flex-1 rounded-lg bg-surface-container px-4 font-bold text-primary active:scale-[0.98]" onClick={reset} type="button" disabled={busy}>
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

      {form ? <p className="text-center text-xs text-muted">Total dari struk: {formatCurrency(Number(form.amount) || 0, "IDR")}</p> : null}
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}

