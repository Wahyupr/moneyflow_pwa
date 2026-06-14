"use client";

import { ChevronDown, Store, Upload, X } from "lucide-react";

import { useCallback, useEffect, useRef, useState } from "react";

type Category = {
  id: string;
  name: string;
  type: "expense" | "income" | "transfer";
};

type Merchant = {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  category_id: string | null;
  is_system: boolean;
  created_at: string;
};

export function MerchantManager({ onStatus }: { onStatus: (message: string) => void }) {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [logo, setLogo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setCategoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const load = useCallback(async () => {
    const [merchantsRes, categoriesRes] = await Promise.all([
      fetch("/api/admin/merchants"),
      fetch("/api/admin/categories")
    ]);

    if (merchantsRes.ok) {
      setMerchants((await merchantsRes.json()).merchants ?? []);
    }
    if (categoriesRes.ok) {
      setCategories((await categoriesRes.json()).categories ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setName("");
    setWebsite("");
    setLogo("");
    setCategoryId("");
    setEditingId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleLogoFile(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/merchants/logo", { method: "POST", body });
      const payload = await response.json().catch(() => null);

      if (response.ok && payload?.url) {
        setLogo(payload.url);
        onStatus("Logo berhasil di-upload.");
      } else {
        onStatus(payload?.error ?? "Gagal upload logo.");
      }
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!name.trim()) {
      onStatus("Nama merchant wajib diisi.");
      return;
    }

    const url = editingId ? `/api/admin/merchants/${editingId}` : "/api/admin/merchants";
    const method = editingId ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        logo_url: logo,
        website_url: website,
        category_id: categoryId ? categoryId : null
      })
    });

    if (response.ok) {
      onStatus(editingId ? "Merchant diperbarui." : "Merchant ditambahkan.");
      resetForm();
      void load();
    } else {
      onStatus(editingId ? "Gagal memperbarui merchant." : "Gagal menambahkan merchant.");
    }
  }

  function startEdit(merchant: Merchant) {
    setEditingId(merchant.id);
    setName(merchant.name);
    setWebsite(merchant.website_url ?? "");
    setLogo(merchant.logo_url ?? "");
    setCategoryId(merchant.category_id ?? "");
  }

  async function remove(id: string) {
    const response = await fetch(`/api/admin/merchants/${id}`, { method: "DELETE" });
    if (response.ok) {
      onStatus("Merchant dihapus.");
      if (editingId === id) {
        resetForm();
      }
      void load();
    } else {
      onStatus("Gagal menghapus merchant.");
    }
  }

  const categoryName = (id: string | null) =>
    id ? categories.find((category) => category.id === id)?.name ?? null : null;

  return (
    <section className="rounded-xl bg-surface p-4 shadow-card" id="merchants">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-surface-container text-primary">
          <Store size={18} />
        </div>
        <div>
          <h2 className="font-bold text-ink">Merchant Global</h2>
          <p className="text-sm text-muted">Hanya admin yang bisa kelola merchant.</p>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-muted">Nama merchant</span>
        <input
          className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Netflix"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-sm font-semibold text-muted">Link / Website</span>
        <input
          className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          placeholder="https://www.netflix.com"
          inputMode="url"
        />
      </label>

      <div className="mt-3">
        <span className="text-sm font-semibold text-muted">Kategori</span>
        <div className="relative mt-2" ref={categoryRef}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={categoryOpen}
            onClick={() => setCategoryOpen((open) => !open)}
            className="flex min-h-12 w-full items-center gap-2 rounded-lg border border-outline bg-surface px-3 text-left focus:border-primary focus:outline-none"
          >
            <span className={`flex-1 truncate ${categoryId ? "text-ink" : "text-muted"}`}>
              {categoryName(categoryId) ?? "Tanpa kategori"}
            </span>
            <ChevronDown size={18} className={`shrink-0 text-muted transition ${categoryOpen ? "rotate-180" : ""}`} />
          </button>

          {categoryOpen ? (
            <ul
              role="listbox"
              className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-outline bg-surface py-1 shadow-lift"
            >
              <li role="option" aria-selected={categoryId === ""}>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryId("");
                    setCategoryOpen(false);
                  }}
                  className={`flex min-h-10 w-full items-center px-3 text-left text-sm transition ${
                    categoryId === "" ? "bg-primary-container/15 font-semibold text-primary" : "text-ink hover:bg-surface-container"
                  }`}
                >
                  Tanpa kategori
                </button>
              </li>
              {categories.map((category) => {
                const selected = categoryId === category.id;

                return (
                  <li key={category.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryId(category.id);
                        setCategoryOpen(false);
                      }}
                      className={`flex min-h-10 w-full items-center px-3 text-left text-sm transition ${
                        selected ? "bg-primary-container/15 font-semibold text-primary" : "text-ink hover:bg-surface-container"
                      }`}
                    >
                      {category.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>


      <div className="mt-3">
        <span className="text-sm font-semibold text-muted">Logo</span>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex size-14 items-center justify-center overflow-hidden rounded-lg border border-outline bg-surface-container text-primary">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Preview logo" className="size-full object-cover" src={logo} />
            ) : (
              <Store size={20} />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-surface-container px-3 text-sm font-bold text-primary active:scale-[0.98] disabled:opacity-60"
              onClick={() => fileInputRef.current?.click()}
              type="button"
              disabled={uploading}
            >
              <Upload size={16} />
              {uploading ? "Mengupload..." : "Upload gambar"}
            </button>
            {logo ? (
              <button
                className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg px-2 text-xs font-bold text-muted active:scale-[0.98]"
                onClick={() => {
                  setLogo("");
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                type="button"
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
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleLogoFile(file);
              }
            }}
          />
        </div>
        <input
          className="mt-2 min-h-11 w-full rounded-lg border border-outline bg-surface px-3 text-sm focus:border-primary focus:outline-none"
          value={logo}
          onChange={(event) => setLogo(event.target.value)}
          placeholder="atau tempel URL logo: https://.../netflix.png"
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          className="min-h-12 flex-1 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98]"
          onClick={submit}
          type="button"
        >
          {editingId ? "Simpan Perubahan" : "Tambah Merchant"}
        </button>
        {editingId ? (
          <button
            className="min-h-12 rounded-lg bg-surface-container px-4 font-bold text-primary active:scale-[0.98]"
            onClick={resetForm}
            type="button"
          >
            Batal
          </button>
        ) : null}
      </div>

      {merchants.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {merchants.map((merchant) => (
            <li className="flex items-center gap-3 rounded-lg border border-outline p-2" key={merchant.id}>
              {merchant.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={merchant.name} className="size-9 rounded-md object-cover" src={merchant.logo_url} />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-md bg-surface-container text-primary">
                  <Store size={16} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{merchant.name}</p>
                <p className="truncate text-xs text-muted">
                  {[categoryName(merchant.category_id), merchant.website_url].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <button
                className="min-h-9 rounded-lg bg-surface-container px-3 text-xs font-bold text-primary active:scale-[0.98]"
                onClick={() => startEdit(merchant)}
                type="button"
              >
                Edit
              </button>
              <button
                className="min-h-9 rounded-lg bg-error-container px-3 text-xs font-bold text-on-error-container active:scale-[0.98]"
                onClick={() => remove(merchant.id)}
                type="button"
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">Belum ada merchant global.</p>
      )}
    </section>
  );
}


