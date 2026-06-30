"use client";

import { Check, ChevronDown, Plus, Search, Tags, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog";
import { Toast, useToast } from "@/components/ui/toast";
import { CATEGORY_ICON_OPTIONS, getCategoryIcon, getCategoryIconLabel } from "@/lib/category-icons";

type CategoryType = "expense" | "income" | "transfer";

type Category = {
  id: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  user_id: string | null;
};

type ConfirmTarget = { id: string; name: string };

const TYPE_DEFAULT_COLOR: Record<string, string> = {
  expense: "#EF4444",
  income: "#10B981",
  transfer: "#6366F1"
};

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "expense", label: "Pengeluaran" },
  { value: "income", label: "Pemasukan" }
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));

export default function CategoriesPage() {
  return (
    <AppFrame title="Kategori" subtitle="Kelola daftar kategori transaksi">
      <CategoriesContent />
    </AppFrame>
  );
}

function CategoriesContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [showSystem, setShowSystem] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast, showToast } = useToast();

  useEffect(() => {
    let active = true;
    fetch("/api/categories")
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        if (active) setCategories((json.categories ?? []) as Category[]);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const ownCategories = useMemo(
    () => categories.filter((c) => !c.is_system).sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );
  const systemCategories = useMemo(
    () => categories.filter((c) => c.is_system).sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const filteredOwn = useMemo(() => {
    if (!query.trim()) return ownCategories;
    const q = query.toLowerCase();
    return ownCategories.filter((c) => c.name.toLowerCase().includes(q) || TYPE_LABEL[c.type]?.toLowerCase().includes(q));
  }, [ownCategories, query]);

  const filteredSystem = useMemo(() => {
    if (!query.trim()) return systemCategories;
    const q = query.toLowerCase();
    return systemCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [systemCategories, query]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Kategori dihapus.");
      const refresh = await fetch("/api/categories");
      if (refresh.ok) setCategories(((await refresh.json()).categories ?? []) as Category[]);
    } else {
      showToast("Gagal menghapus kategori.", "error");
    }
  }

  return (
    <div className="mt-5 space-y-5">
      <Toast toast={toast} />

      <section className="rounded-2xl bg-surface p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Tags size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-ink">Kategori Pribadi</h2>
            <p className="text-xs text-muted">
              {ownCategories.length} kategori · {systemCategories.length} global tersedia
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-bold text-white active:scale-[0.98]"
          >
            <Plus size={16} />
            Tambah
          </button>
        </div>

        <label className="mt-3 block">
          <span className="sr-only">Cari kategori</span>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari kategori atau tipe..."
              className="min-h-11 w-full rounded-lg border border-outline bg-surface pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </label>
      </section>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-container" />
          ))}
        </div>
      ) : filteredOwn.length > 0 ? (
        <section>
          <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">
            Kategori Saya ({filteredOwn.length})
          </h3>
          <ul className="space-y-2">
            {filteredOwn.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-xl bg-surface p-3 shadow-card transition active:scale-[0.99]"
              >
                <CategoryAvatar category={c} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{c.name}</p>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                    {TYPE_LABEL[c.type] ?? c.type}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirm({ id: c.id, name: c.name })}
                  className="flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-expense/10 hover:text-expense active:scale-95"
                  aria-label={`Hapus ${c.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : query.trim() ? (
        <div className="rounded-2xl bg-surface p-6 text-center shadow-card">
          <p className="text-sm text-muted">Tidak ada kategori cocok dengan &ldquo;{query}&rdquo;.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-surface p-6 text-center shadow-card">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-container text-primary">
            <Tags size={22} />
          </div>
          <p className="mt-3 font-bold text-ink">Belum ada kategori pribadi</p>
          <p className="mt-1 text-sm text-muted">Buat kategori untuk mengelompokkan transaksi Anda.</p>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white active:scale-[0.98]"
          >
            <Plus size={16} />
            Tambah Kategori
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
            <span>Kategori Global ({filteredSystem.length})</span>
            <span className="text-[10px] normal-case text-muted/70">{showSystem ? "Sembunyikan" : "Tampilkan"}</span>
          </button>
          {showSystem ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filteredSystem.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2.5 rounded-xl bg-surface p-3 shadow-card"
                >
                  <CategoryAvatar category={c} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-ink">{c.name}</p>
                    <p className="text-[10px] text-muted">{TYPE_LABEL[c.type] ?? c.type}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {formOpen ? (
        <CategoryFormDialog
          onClose={() => setFormOpen(false)}
          onSaved={(message) => {
            showToast(message);
            setFormOpen(false);
            void refresh();
          }}
        />
      ) : null}

      {confirm ? (
        <ConfirmDialog
          title="Hapus Kategori"
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

  async function refresh() {
    const res = await fetch("/api/categories");
    if (res.ok) setCategories(((await res.json()).categories ?? []) as Category[]);
  }
}

function CategoryAvatar({ category, size = "md" }: { category: Category; size?: "sm" | "md" }) {
  const Icon = getCategoryIcon(category.icon);
  const dim = size === "sm" ? "size-8" : "size-10";
  const iconSize = size === "sm" ? 14 : 16;
  const bg = category.color ?? TYPE_DEFAULT_COLOR[category.type] ?? "#6366F1";
  return (
    <span
      className={`${dim} flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm`}
      style={{ backgroundColor: bg }}
    >
      <Icon size={iconSize} aria-hidden="true" />
    </span>
  );
}

function CategoryFormDialog({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("expense");
  const [icon, setIcon] = useState<string>("tag");
  const [color, setColor] = useState<string>(TYPE_DEFAULT_COLOR.expense);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iconOpen, setIconOpen] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (iconRef.current && !iconRef.current.contains(event.target as Node)) {
        setIconOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleTypeChange(next: string) {
    setType(next);
    setColor(TYPE_DEFAULT_COLOR[next] ?? TYPE_DEFAULT_COLOR.expense);
  }

  const SelectedIcon = getCategoryIcon(icon);
  const selectedIconLabel = getCategoryIconLabel(icon);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Nama kategori wajib diisi.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, type, icon, color })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Gagal menyimpan kategori.");
        return;
      }
      onSaved("Kategori ditambahkan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={submit}
        className="flex w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-lift sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-outline px-5 py-4">
          <h3 className="font-bold text-ink">Kategori Baru</h3>
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
          {/* Live preview chip */}
          <div
            className="flex items-center gap-3 rounded-2xl p-4 text-white shadow-card"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-white/20">
              <SelectedIcon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{name.trim() || "Nama kategori"}</p>
              <p className="text-[11px] uppercase tracking-wider text-white/80">{TYPE_LABEL[type]}</p>
            </div>
          </div>

          {/* Type selector */}
          <div className="mt-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Tipe</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const active = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleTypeChange(opt.value)}
                    className={`flex min-h-11 items-center justify-center rounded-xl text-xs font-bold transition active:scale-[0.98] ${
                      active ? "bg-primary text-white shadow-card" : "bg-surface-container text-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <label className="mt-4 block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Nama</span>
            <input
              className="mt-2 min-h-12 w-full rounded-xl border border-outline bg-surface px-4 text-ink focus:border-primary focus:outline-none"
              placeholder="cth. Makan Siang"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>

          {/* Icon picker */}
          <div className="relative mt-4" ref={iconRef}>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Ikon</span>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={iconOpen}
              onClick={() => setIconOpen((open) => !open)}
              className="mt-2 flex min-h-12 w-full items-center gap-2 rounded-xl border border-outline bg-surface px-4 text-left focus:border-primary focus:outline-none"
            >
              <span
                className="flex size-7 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: color }}
              >
                <SelectedIcon size={14} />
              </span>
              <span className="flex-1 truncate font-semibold text-ink">{selectedIconLabel}</span>
              <ChevronDown size={16} className={`shrink-0 text-muted transition ${iconOpen ? "rotate-180" : ""}`} />
            </button>
            {iconOpen ? (
              <ul
                role="listbox"
                className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-outline bg-surface py-1 shadow-lift"
              >
                {CATEGORY_ICON_OPTIONS.map((option) => {
                  const OptionIcon = option.Icon;
                  const selected = icon === option.value;
                  return (
                    <li key={option.value} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        onClick={() => { setIcon(option.value); setIconOpen(false); }}
                        className={`flex min-h-10 w-full items-center gap-3 px-4 text-left text-sm transition ${
                          selected ? "bg-primary-container/30 font-bold text-primary" : "text-ink hover:bg-surface-container"
                        }`}
                      >
                        <OptionIcon size={16} className="shrink-0 text-primary" />
                        {option.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {/* Color */}
          <div className="mt-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Warna</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {[...new Set([...Object.values(TYPE_DEFAULT_COLOR), "#1668DC", "#F59E0B", "#8B5CF6", "#EC4899", "#0EA5E9", "#14B8A6"])]
                .map((swatch) => {
                  const active = color.toLowerCase() === swatch.toLowerCase();
                  return (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setColor(swatch)}
                      className={`size-9 rounded-full border-2 transition active:scale-90 ${active ? "border-ink" : "border-transparent"}`}
                      style={{ backgroundColor: swatch }}
                      aria-label={`Pilih warna ${swatch}`}
                      aria-pressed={active}
                    />
                  );
                })}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                aria-label="Pilih warna kustom"
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-outline bg-surface"
                type="color"
                value={/^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#1668DC"}
                onChange={(e) => setColor(e.target.value)}
              />
              <input
                className="min-h-10 flex-1 rounded-lg border border-outline bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#EF4444"
              />
            </div>
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
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </footer>
      </form>
    </div>
  );
}
