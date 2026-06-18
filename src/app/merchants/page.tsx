"use client";

import { Check, Pencil, Plus, Search, Store, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppFrame } from "@/components/app-frame";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SelectMenu, type SelectOption } from "@/components/ui/select-menu";
import { getCategoryIcon } from "@/lib/category-icons";

type Merchant = {
  id: string;
  name: string;
  logo_url: string | null;
  category_id: string | null;
  is_system: boolean;
  created_at: string;
};

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: "expense" | "income" | "transfer";
};

type ConfirmState = {
  id: string;
  name: string;
};

const TYPE_DEFAULT_COLOR: Record<string, string> = {
  expense: "#EF4444",
  income: "#10B981",
  transfer: "#6366F1"
};

export default function MerchantsPage() {
  return (
    <AppFrame title="Merchant" subtitle="Kelola daftar merchant pribadi">
      <MerchantsContent />
    </AppFrame>
  );
}

function MerchantsContent() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [showSystem, setShowSystem] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Merchant | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [mRes, cRes] = await Promise.all([
      fetch("/api/merchants"),
      fetch("/api/categories")
    ]);
    if (mRes.ok) {
      const json = await mRes.json();
      setMerchants((json.merchants ?? []) as Merchant[]);
    }
    if (cRes.ok) {
      const json = await cRes.json();
      setCategories((json.categories ?? []) as Category[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const categoryOptions: SelectOption[] = useMemo(
    () =>
      categories
        .filter((c) => c.type !== "transfer")
        .map((c) => {
          const Icon = getCategoryIcon(c.icon);
          return {
            value: c.id,
            label: c.name,
            icon: (
              <span
                className="flex size-5 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: c.color ?? TYPE_DEFAULT_COLOR[c.type] ?? "#6366F1" }}
              >
                <Icon size={11} />
              </span>
            )
          };
        }),
    [categories]
  );

  const ownMerchants = useMemo(
    () => merchants.filter((m) => !m.is_system).sort((a, b) => a.name.localeCompare(b.name)),
    [merchants]
  );
  const systemMerchants = useMemo(
    () => merchants.filter((m) => m.is_system).sort((a, b) => a.name.localeCompare(b.name)),
    [merchants]
  );

  const filteredOwn = useMemo(() => {
    if (!query.trim()) return ownMerchants;
    const q = query.toLowerCase();
    return ownMerchants.filter((m) => {
      const catName = m.category_id ? categoryMap.get(m.category_id)?.name ?? "" : "";
      return m.name.toLowerCase().includes(q) || catName.toLowerCase().includes(q);
    });
  }, [ownMerchants, query, categoryMap]);

  const filteredSystem = useMemo(() => {
    if (!query.trim()) return systemMerchants;
    const q = query.toLowerCase();
    return systemMerchants.filter((m) => m.name.toLowerCase().includes(q));
  }, [systemMerchants, query]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(merchant: Merchant) {
    setEditing(merchant);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/merchants/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStatus("Merchant dihapus.");
      void load();
    } else {
      setStatus("Gagal menghapus merchant.");
    }
  }

  return (
    <div className="mt-5 space-y-5">
      {status ? (
        <div className="flex items-center justify-between rounded-lg bg-surface-container px-3 py-2 text-sm font-semibold text-primary">
          <span>{status}</span>
          <button
            type="button"
            onClick={() => setStatus(null)}
            className="flex size-6 items-center justify-center rounded-full text-muted hover:bg-surface-low"
            aria-label="Tutup pesan"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      <section className="rounded-2xl bg-surface p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Store size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-ink">Merchant Pribadi</h2>
            <p className="text-xs text-muted">
              {ownMerchants.length} merchant · {systemMerchants.length} global tersedia
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-bold text-white active:scale-[0.98]"
          >
            <Plus size={16} />
            Tambah
          </button>
        </div>

        <label className="mt-3 block">
          <span className="sr-only">Cari merchant</span>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari merchant atau kategori..."
              className="min-h-11 w-full rounded-lg border border-outline bg-surface pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </label>
      </section>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-container" />
          ))}
        </div>
      ) : filteredOwn.length > 0 ? (
        <section>
          <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">
            Merchant Saya ({filteredOwn.length})
          </h3>
          <ul className="space-y-2">
            {filteredOwn.map((m) => {
              const cat = m.category_id ? categoryMap.get(m.category_id) ?? null : null;
              return (
                <li
                  key={m.id}
                  className="group flex items-center gap-3 rounded-xl bg-surface p-3 shadow-card transition active:scale-[0.99]"
                >
                  <MerchantAvatar merchant={m} category={cat} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{m.name}</p>
                    {cat ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-muted">
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: cat.color ?? TYPE_DEFAULT_COLOR[cat.type] ?? "#6366F1" }}
                        />
                        {cat.name}
                      </span>
                    ) : (
                      <span className="mt-1 block text-[11px] text-muted">Tanpa kategori</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(m)}
                      className="flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-primary/10 hover:text-primary active:scale-95"
                      aria-label={`Edit ${m.name}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ id: m.id, name: m.name })}
                      className="flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-expense/10 hover:text-expense active:scale-95"
                      aria-label={`Hapus ${m.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : query.trim() ? (
        <div className="rounded-2xl bg-surface p-6 text-center shadow-card">
          <p className="text-sm text-muted">Tidak ada merchant cocok dengan "{query}".</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-surface p-6 text-center shadow-card">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-container text-primary">
            <Store size={22} />
          </div>
          <p className="mt-3 font-bold text-ink">Belum ada merchant pribadi</p>
          <p className="mt-1 text-sm text-muted">Tambahkan merchant untuk pencatatan transaksi yang lebih cepat.</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white active:scale-[0.98]"
          >
            <Plus size={16} />
            Tambah Merchant
          </button>
        </div>
      )}

      {filteredSystem.length > 0 ? (
        <section>
          <button
            type="button"
            onClick={() => setShowSystem((v) => !v)}
            className="mb-2 flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs font-bold uppercase tracking-wider text-muted"
          >
            <span>Merchant Global ({filteredSystem.length})</span>
            <span className="text-[10px] normal-case text-muted/70">{showSystem ? "Sembunyikan" : "Tampilkan"}</span>
          </button>
          {showSystem ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filteredSystem.map((m) => {
                const cat = m.category_id ? categoryMap.get(m.category_id) ?? null : null;
                return (
                  <li
                    key={m.id}
                    className="flex flex-col items-center gap-1.5 rounded-xl bg-surface p-3 text-center shadow-card"
                  >
                    <MerchantAvatar merchant={m} category={cat} size="sm" />
                    <p className="line-clamp-2 text-xs font-semibold text-ink">{m.name}</p>
                    {cat ? (
                      <span className="text-[10px] text-muted">{cat.name}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}

      {formOpen ? (
        <MerchantFormDialog
          initial={editing}
          categories={categoryOptions}
          onClose={closeForm}
          onSaved={(message) => {
            setStatus(message);
            closeForm();
            void load();
          }}
        />
      ) : null}

      {confirm ? (
        <ConfirmDialog
          title="Hapus Merchant"
          message={`"${confirm.name}" akan dihapus secara permanen.`}
          confirmLabel="Ya, Hapus"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const target = confirm;
            setConfirm(null);
            void handleDelete(target.id);
          }}
        />
      ) : null}
    </div>
  );
}

function MerchantAvatar({
  merchant,
  category,
  size = "md"
}: {
  merchant: Merchant;
  category: Category | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "size-10" : "size-11";
  const iconSize = size === "sm" ? 16 : 18;
  const initialSize = size === "sm" ? "text-xs" : "text-sm";

  if (merchant.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={merchant.logo_url}
        alt={merchant.name}
        className={`${dim} shrink-0 rounded-xl object-cover`}
      />
    );
  }

  const bg = category?.color ?? TYPE_DEFAULT_COLOR[category?.type ?? "expense"] ?? "#6366F1";

  return (
    <span
      className={`${dim} flex shrink-0 items-center justify-center rounded-xl text-white`}
      style={{ backgroundColor: bg }}
    >
      <span className={`font-bold uppercase ${initialSize}`}>
        {merchant.name.slice(0, 1)}
      </span>
    </span>
  );
}

function MerchantFormDialog({
  initial,
  categories,
  onClose,
  onSaved
}: {
  initial: Merchant | null;
  categories: SelectOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
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

      onSaved(initial ? "Merchant diperbarui." : "Merchant ditambahkan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
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
