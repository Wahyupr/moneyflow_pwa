"use client";

import {
  Banknote,
  Bus,
  Car,
  Coffee,
  CreditCard,
  Gift,
  GraduationCap,
  Heart,
  Home,
  Plane,
  PiggyBank,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Utensils,
  Wallet,
  Wrench,
  Zap
} from "lucide-react";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";


type CategoryType = "expense" | "income" | "transfer";

/** Curated set of category icons the admin can choose from (no free typing). */
const ICON_OPTIONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "tag", label: "Umum", Icon: Tag },
  { value: "utensils", label: "Makan", Icon: Utensils },
  { value: "coffee", label: "Kopi", Icon: Coffee },
  { value: "shopping-cart", label: "Belanja", Icon: ShoppingCart },
  { value: "shopping-bag", label: "Tas Belanja", Icon: ShoppingBag },
  { value: "car", label: "Mobil", Icon: Car },
  { value: "bus", label: "Transport", Icon: Bus },
  { value: "plane", label: "Travel", Icon: Plane },
  { value: "home", label: "Rumah", Icon: Home },
  { value: "zap", label: "Listrik", Icon: Zap },
  { value: "smartphone", label: "Pulsa", Icon: Smartphone },
  { value: "receipt", label: "Tagihan", Icon: Receipt },
  { value: "heart", label: "Kesehatan", Icon: Heart },
  { value: "graduation-cap", label: "Pendidikan", Icon: GraduationCap },
  { value: "gift", label: "Hadiah", Icon: Gift },
  { value: "sparkles", label: "Hiburan", Icon: Sparkles },
  { value: "wrench", label: "Perbaikan", Icon: Wrench },
  { value: "banknote", label: "Gaji", Icon: Banknote },
  { value: "wallet", label: "Dompet", Icon: Wallet },
  { value: "piggy-bank", label: "Tabungan", Icon: PiggyBank },
  { value: "credit-card", label: "Kartu", Icon: CreditCard }
];

const ICON_BY_VALUE = new Map(ICON_OPTIONS.map((option) => [option.value, option.Icon]));


type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  is_system: boolean;
};

const TYPE_LABELS: Record<CategoryType, string> = {
  expense: "Pengeluaran",
  income: "Pemasukan",
  transfer: "Transfer"
};

const TYPE_OPTIONS: CategoryType[] = ["expense", "income", "transfer"];


export function CategoryManager({ onStatus }: { onStatus: (message: string) => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("tag");
  const [color, setColor] = useState("#1668DC");
  const [type, setType] = useState<CategoryType>("expense");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [iconOpen, setIconOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const SelectedIcon = ICON_BY_VALUE.get(icon) ?? Tag;
  const selectedLabel = ICON_OPTIONS.find((option) => option.value === icon)?.label ?? "Umum";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (iconRef.current && !iconRef.current.contains(target)) {
        setIconOpen(false);
      }
      if (typeRef.current && !typeRef.current.contains(target)) {
        setTypeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const load = useCallback(async () => {

    const response = await fetch("/api/admin/categories");
    if (response.ok) {
      setCategories((await response.json()).categories ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setName("");
    setIcon("tag");
    setColor("#1668DC");
    setType("expense");
    setEditingId(null);
  }

  async function submit() {
    if (!name.trim()) {
      onStatus("Nama kategori wajib diisi.");
      return;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      onStatus("Warna harus format hex, contoh #1668DC.");
      return;
    }

    const url = editingId ? `/api/admin/categories/${editingId}` : "/api/admin/categories";
    const method = editingId ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, icon: icon.trim() || "tag", color, type })
    });

    if (response.ok) {
      onStatus(editingId ? "Kategori diperbarui." : "Kategori ditambahkan.");
      resetForm();
      void load();
    } else {
      onStatus(editingId ? "Gagal memperbarui kategori." : "Gagal menambahkan kategori.");
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setName(category.name);
    setIcon(category.icon);
    setColor(category.color);
    setType(category.type);
  }

  async function remove(id: string) {
    const response = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    if (response.ok) {
      onStatus("Kategori dihapus.");
      if (editingId === id) {
        resetForm();
      }
      void load();
    } else {
      onStatus("Gagal menghapus kategori.");
    }
  }

  return (
    <section className="rounded-xl bg-surface p-4 shadow-card" id="categories">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-surface-container text-primary">
          <Tag size={18} />
        </div>
        <div>
          <h2 className="font-bold text-ink">Master Kategori</h2>
          <p className="text-sm text-muted">Kategori global untuk semua user.</p>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-muted">Nama kategori</span>
        <input
          className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Makan & Minum"
        />
      </label>

      <div className="mt-3">
        <span className="text-sm font-semibold text-muted">Tipe</span>
        <div className="relative mt-2" ref={typeRef}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={typeOpen}
            onClick={() => setTypeOpen((open) => !open)}
            className="flex min-h-12 w-full items-center gap-2 rounded-lg border border-outline bg-surface px-3 text-left focus:border-primary focus:outline-none"
          >
            <span className="flex-1 truncate text-ink">{TYPE_LABELS[type]}</span>
            <ChevronDown size={18} className={`shrink-0 text-muted transition ${typeOpen ? "rotate-180" : ""}`} />
          </button>

          {typeOpen ? (
            <ul
              role="listbox"
              className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-outline bg-surface py-1 shadow-lift"
            >
              {TYPE_OPTIONS.map((option) => {
                const selected = type === option;

                return (
                  <li key={option} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        setType(option);
                        setTypeOpen(false);
                      }}
                      className={`flex min-h-10 w-full items-center px-3 text-left text-sm transition ${
                        selected ? "bg-primary-container/15 font-semibold text-primary" : "text-ink hover:bg-surface-container"
                      }`}
                    >
                      {TYPE_LABELS[option]}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>


      <div className="mt-3">
        <span className="text-sm font-semibold text-muted">Ikon</span>
        <div className="relative mt-2" ref={iconRef}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={iconOpen}
            onClick={() => setIconOpen((open) => !open)}
            className="flex min-h-12 w-full items-center gap-2 rounded-lg border border-outline bg-surface px-3 text-left focus:border-primary focus:outline-none"
          >
            <span className="text-primary">
              <SelectedIcon size={18} />
            </span>
            <span className="flex-1 truncate text-ink">{selectedLabel}</span>
            <ChevronDown size={18} className={`shrink-0 text-muted transition ${iconOpen ? "rotate-180" : ""}`} />
          </button>

          {iconOpen ? (
            <ul
              role="listbox"
              className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-outline bg-surface py-1 shadow-lift"
            >
              {ICON_OPTIONS.map((option) => {
                const OptionIcon = option.Icon;
                const selected = icon === option.value;

                return (
                  <li key={option.value} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        setIcon(option.value);
                        setIconOpen(false);
                      }}
                      className={`flex min-h-10 w-full items-center gap-3 px-3 text-left text-sm transition ${
                        selected ? "bg-primary-container/15 font-semibold text-primary" : "text-ink hover:bg-surface-container"
                      }`}
                    >
                      <OptionIcon size={18} className="shrink-0 text-primary" />
                      {option.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>




      <label className="mt-3 block">
        <span className="text-sm font-semibold text-muted">Warna</span>
        <div className="mt-2 flex items-center gap-2">
          <input
            aria-label="Pilih warna kategori"
            className="h-12 w-14 shrink-0 cursor-pointer rounded-lg border border-outline bg-surface"
            type="color"
            value={/^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#1668DC"}
            onChange={(event) => setColor(event.target.value)}
          />
          <input
            className="min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            placeholder="#1668DC"
          />
        </div>
      </label>

      <div className="mt-4 flex gap-2">
        <button className="min-h-12 flex-1 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98]" onClick={submit} type="button">
          {editingId ? "Simpan Perubahan" : "Tambah Kategori"}
        </button>
        {editingId ? (
          <button className="min-h-12 rounded-lg bg-surface-container px-4 font-bold text-primary active:scale-[0.98]" onClick={resetForm} type="button">
            Batal
          </button>
        ) : null}
      </div>

      {categories.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {categories.map((category) => {
            const ListIcon = ICON_BY_VALUE.get(category.icon) ?? Tag;

            return (
            <li className="flex items-center gap-3 rounded-lg border border-outline p-2" key={category.id}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: category.color }}>
                <ListIcon size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{category.name}</p>
                <p className="truncate text-xs text-muted">{TYPE_LABELS[category.type]}</p>
              </div>

              <button className="min-h-9 rounded-lg bg-surface-container px-3 text-xs font-bold text-primary active:scale-[0.98]" onClick={() => startEdit(category)} type="button">
                Edit
              </button>
              <button className="min-h-9 rounded-lg bg-error-container px-3 text-xs font-bold text-on-error-container active:scale-[0.98]" onClick={() => remove(category.id)} type="button">
                Hapus
              </button>
            </li>
            );
          })}
        </ul>

      ) : (
        <p className="mt-4 text-sm text-muted">Belum ada kategori global.</p>
      )}
    </section>
  );
}

