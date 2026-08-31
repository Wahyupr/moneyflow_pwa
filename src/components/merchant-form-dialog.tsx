"use client";

import { Check, Store, Upload, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { SelectMenu, type SelectOption } from "@/components/ui/select-menu";

export type SavedMerchant = {
  id: string;
  name: string;
  logo_url: string | null;
  category_id: string | null;
  is_system: boolean;
};

type MerchantInitial = {
  id: string;
  name: string;
  logo_url: string | null;
  category_id: string | null;
};

/**
 * Reusable dialog to create or edit a personal merchant. Shared by the
 * Merchants management page and the new-transaction form so "add merchant"
 * works inline without leaving the current screen.
 *
 * `onSaved` receives the saved merchant so callers can refresh their list and
 * auto-select the new entry.
 */
export function MerchantFormDialog({
  initial,
  categories,
  onClose,
  onSaved
}: {
  initial: MerchantInitial | null;
  categories: SelectOption[];
  onClose: () => void;
  onSaved: (merchant: SavedMerchant, message: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleLogoFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/merchants/logo", { method: "POST", body });
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.url) {
        setLogoUrl(payload.url);
      } else {
        setError(payload?.error ?? "Gagal upload logo.");
      }
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Nama merchant wajib diisi.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const payload = {
        name: trimmed,
        category_id: categoryId ? categoryId : null,
        logo_url: logoUrl ? logoUrl : null
      };

      const url = initial ? `/api/merchants/${initial.id}` : "/api/merchants";
      const method = initial ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Gagal menyimpan merchant.");
        return;
      }

      const data = await res.json().catch(() => null);
      const saved = (data?.merchant ?? null) as SavedMerchant | null;
      onSaved(
        saved ?? {
          id: initial?.id ?? "",
          name: trimmed,
          logo_url: logoUrl ? logoUrl : null,
          category_id: categoryId ? categoryId : null,
          is_system: false
        },
        initial ? "Merchant diperbarui." : "Merchant ditambahkan."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={submit}
        className="flex w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-lift sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-outline px-5 py-4">
          <h3 className="font-bold text-ink">
            {initial ? "Edit Merchant" : "Tambah Merchant"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface-container"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="text-sm font-semibold text-muted">Nama merchant</span>
            <input
              autoFocus
              className="mt-1 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Netflix, Indomaret, dll."
            />
          </label>

          <div className="mt-3">
            <span className="text-sm font-semibold text-muted">Kategori — opsional</span>
            <SelectMenu
              value={categoryId}
              options={categories}
              onChange={setCategoryId}
              placeholder="Tanpa kategori"
              ariaLabel="Pilih kategori merchant"
            />
          </div>

          <div className="mt-3">
            <span className="text-sm font-semibold text-muted">Logo — opsional</span>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-outline bg-surface-container text-primary">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="Preview logo" className="size-full object-cover" src={logoUrl} />
                ) : (
                  <Store size={20} />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-surface-container px-3 text-sm font-bold text-primary active:scale-[0.98] disabled:opacity-60"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload size={16} />
                  {uploading ? "Mengupload..." : "Upload gambar"}
                </button>
                {logoUrl ? (
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg px-2 text-xs font-bold text-muted active:scale-[0.98]"
                    onClick={() => {
                      setLogoUrl("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X size={14} />
                    Hapus logo
                  </button>
                ) : null}
              </div>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleLogoFile(file);
                }}
              />
            </div>
            <input
              className="mt-2 min-h-11 w-full rounded-lg border border-outline bg-surface px-3 text-sm focus:border-primary focus:outline-none"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="atau tempel URL logo: https://.../logo.png"
            />
          </div>

          {error ? (
            <p className="mt-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>
          ) : null}
        </div>

        <footer className="flex gap-2 border-t border-outline px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-11 flex-1 rounded-lg bg-surface-container font-bold text-ink active:scale-[0.98]"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="min-h-11 flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary font-bold text-white active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? null : <Check size={16} />}
            {busy ? "Menyimpan..." : initial ? "Simpan" : "Tambah"}
          </button>
        </footer>
      </form>
    </div>
  );
}
