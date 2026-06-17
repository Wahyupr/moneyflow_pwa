"use client";

import {
  Bell,
  ChevronDown,
  ChevronRight,
  HandCoins,
  Landmark,
  List,
  LogOut,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Store,
  Trash2,
  WalletCards,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { MerchantManager } from "@/components/merchant-manager";
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog";
import { CATEGORY_ICON_OPTIONS, getCategoryIcon, getCategoryIconLabel } from "@/lib/category-icons";

type ProfilePayload = {
  user?: { email?: string | null };
  profile?: { display_name?: string | null; role?: "user" | "admin" | null };
};

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((json: ProfilePayload | null) => {
        if (json && active) {
          setDisplayName(json.profile?.display_name ?? "");
          setEmail(json.user?.email ?? "");
          setRole(json.profile?.role === "admin" ? "admin" : "user");
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          locale: "id-ID",
          default_currency: "IDR"
        })
      });
      setStatus(response.ok ? "Profile tersimpan." : "Gagal menyimpan profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  const initials = (displayName.trim() || email.trim() || "?")
    .split(/\s+/)
    .map((part) => part.slice(0, 1).toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <AppFrame title="Settings" subtitle="Pengaturan">
      <div className="mt-5 space-y-4">
        {/* HERO — signature moment */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-tertiary p-5 text-white shadow-lift">
          <div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 size-44 rounded-full bg-white/5 blur-3xl" />

          <div className="relative flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black tracking-tight backdrop-blur-sm">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-lg font-bold leading-tight">
                  {loading ? "Memuat..." : displayName.trim() || "Tanpa Nama"}
                </p>
                {role === "admin" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider backdrop-blur-sm">
                    <ShieldCheck size={10} aria-hidden="true" />
                    Admin
                  </span>
                ) : null}
              </div>
              <p className="truncate text-sm text-white/75">{email || "—"}</p>
            </div>
          </div>

          <div className="relative mt-5 space-y-2">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">Nama tampilan</span>
              <input
                className="mt-1 min-h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder:text-white/40 focus:border-white/40 focus:bg-white/15 focus:outline-none"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Nama kamu"
              />
            </label>
            <button
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 font-bold text-primary shadow-card transition active:scale-[0.98] disabled:opacity-60"
              onClick={saveProfile}
              type="button"
              disabled={savingProfile}
            >
              <Save size={18} />
              {savingProfile ? "Menyimpan..." : "Simpan Profile"}
            </button>
          </div>
        </section>

        {/* QUICK ACCESS — Dompet */}
        <Link
          href="/wallets"
          className="relative flex items-center gap-4 overflow-hidden rounded-2xl bg-surface p-4 shadow-card transition active:scale-[0.99]"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-primary/8 blur-2xl" />
          <div className="relative flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <WalletCards size={22} />
          </div>
          <div className="relative min-w-0 flex-1">
            <p className="font-bold text-ink">Dompet</p>
            <p className="truncate text-sm text-muted">Kelola saldo, kartu &amp; dompet bersama</p>
          </div>
          <ChevronRight className="relative shrink-0 text-muted" size={18} />
        </Link>

        {/* QUICK ACCESS — Hutang */}
        <Link
          href="/hutang"
          className="relative flex items-center gap-4 overflow-hidden rounded-2xl bg-surface p-4 shadow-card transition active:scale-[0.99]"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-tertiary/10 blur-2xl" />
          <div className="relative flex size-12 items-center justify-center rounded-2xl bg-tertiary/15 text-tertiary">
            <Landmark size={22} />
          </div>
          <div className="relative min-w-0 flex-1">
            <p className="font-bold text-ink">Hutang</p>
            <p className="truncate text-sm text-muted">KPR, cicilan &amp; pinjaman lainnya</p>
          </div>
          <ChevronRight className="relative shrink-0 text-muted" size={18} />
        </Link>

        {/* QUICK ACCESS — Piutang */}
        <Link
          href="/piutang"
          className="relative flex items-center gap-4 overflow-hidden rounded-2xl bg-surface p-4 shadow-card transition active:scale-[0.99]"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-income/10 blur-2xl" />
          <div className="relative flex size-12 items-center justify-center rounded-2xl bg-income/10 text-income">
            <HandCoins size={22} />
          </div>
          <div className="relative min-w-0 flex-1">
            <p className="font-bold text-ink">Piutang</p>
            <p className="truncate text-sm text-muted">Pinjaman yang Anda berikan ke orang lain</p>
          </div>
          <ChevronRight className="relative shrink-0 text-muted" size={18} />
        </Link>

        {/* USER MERCHANT — grouped list */}
        <UserMerchantSection onStatus={setStatus} />

        {/* USER CATEGORY — grouped list with bottom-sheet form */}
        <UserCategorySection onStatus={setStatus} />

        {/* ADMIN */}
        {role === "admin" ? (
          <>
            <Link
              href="/admin"
              className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-tertiary to-primary p-4 text-white shadow-lift active:scale-[0.99]"
            >
              <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex size-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <ShieldCheck size={20} />
              </div>
              <div className="relative min-w-0 flex-1">
                <p className="font-bold">Panel Admin</p>
                <p className="truncate text-sm text-white/75">Kelola merchant, kategori &amp; user</p>
              </div>
              <Pencil size={16} className="relative text-white/70" />
            </Link>
            <MerchantManager onStatus={setStatus} />
          </>
        ) : null}

        {/* NOTIFICATIONS — placeholder info row */}
        <section className="overflow-hidden rounded-2xl bg-surface shadow-card">
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-surface-container text-primary">
                <Bell size={18} />
              </div>
              <div>
                <p className="font-bold text-ink">Notifikasi</p>
                <p className="text-sm text-muted">Reminder &amp; alert transaksi</p>
              </div>
            </div>
            <span className="rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-muted">
              Segera
            </span>
          </div>
        </section>

        {status ? (
          <p className="rounded-xl bg-surface-container px-4 py-3 text-sm font-bold text-primary">{status}</p>
        ) : null}

        {/* DANGER ZONE */}
        <section className="rounded-2xl border border-expense/15 bg-expense/5 p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-expense">Danger Zone</p>
          <button
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-expense font-bold text-white shadow-card transition active:scale-[0.98] active:brightness-90"
            onClick={() => {
              fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                window.location.href = "/login";
              });
            }}
            type="button"
          >
            <LogOut size={18} />
            Log Out
          </button>
        </section>
      </div>
    </AppFrame>
  );
}

type MerchantItem = { id: string; name: string; is_system: boolean; logo_url: string | null };
type CategoryItem = { id: string; name: string; type: string; icon: string | null; color: string | null; is_system: boolean; user_id: string | null };

function GroupCard({
  icon: Icon,
  title,
  subtitle,
  children,
  action
}: {
  icon: typeof Store;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-card">
      <header className="flex items-center gap-3 p-4 pb-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-surface-container text-primary">
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-ink">{title}</h2>
          <p className="truncate text-xs text-muted">{subtitle}</p>
        </div>
        {action}
      </header>
      <div className="px-2 pb-2">{children}</div>
    </section>
  );
}

function UserMerchantSection({ onStatus }: { onStatus: (s: string) => void }) {
  const [merchants, setMerchants] = useState<MerchantItem[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [showSystem, setShowSystem] = useState(false);

  async function load() {
    const res = await fetch("/api/merchants");
    if (res.ok) setMerchants(((await res.json()).merchants ?? []) as MerchantItem[]);
  }

  useEffect(() => { void load(); }, []);

  async function add() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/merchants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName.trim() })
      });
      if (res.ok) {
        setNewName("");
        await load();
        onStatus("Merchant ditambahkan.");
      } else {
        const d = await res.json().catch(() => null);
        onStatus(d?.error ?? "Gagal tambah merchant.");
      }
    } finally { setBusy(false); }
  }

  function remove(id: string, name: string) {
    setConfirm({
      title: "Hapus Merchant",
      message: `"${name}" akan dihapus secara permanen.`,
      confirmLabel: "Ya, Hapus",
      onConfirm: async () => {
        const res = await fetch(`/api/merchants?id=${id}`, { method: "DELETE" });
        if (res.ok) { await load(); onStatus("Merchant dihapus."); }
        else onStatus("Gagal hapus merchant.");
      }
    });
  }

  const systemMerchants = merchants.filter((m) => m.is_system);
  const ownMerchants = merchants.filter((m) => !m.is_system);

  return (
    <GroupCard icon={Store} title="Merchant" subtitle={`${ownMerchants.length} merchant pribadi`}>
      {confirm ? <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} /> : null}

      {systemMerchants.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowSystem((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold text-muted transition hover:bg-surface-container"
        >
          <span>Merchant global ({systemMerchants.length})</span>
          <ChevronDown size={14} className={`transition-transform ${showSystem ? "rotate-180" : ""}`} />
        </button>
      ) : null}

      {showSystem ? (
        <div className="space-y-1 pb-1">
          {systemMerchants.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
              {m.logo_url ? (
                <img src={m.logo_url} alt="" className="size-6 rounded-full object-cover" />
              ) : (
                <span className="flex size-6 items-center justify-center rounded-full bg-surface-container text-[10px] font-bold text-muted">
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="flex-1 truncate font-semibold text-ink">{m.name}</span>
            </div>
          ))}
        </div>
      ) : null}

      {ownMerchants.length > 0 ? (
        <ul className="space-y-1 pb-1">
          {ownMerchants.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-surface-low">
              {m.logo_url ? (
                <img src={m.logo_url} alt="" className="size-6 rounded-full object-cover" />
              ) : (
                <span className="flex size-6 items-center justify-center rounded-full bg-surface-container text-[10px] font-bold text-muted">
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="flex-1 truncate font-semibold text-ink">{m.name}</span>
              <button
                type="button"
                onClick={() => remove(m.id, m.name)}
                className="flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-expense/10 hover:text-expense active:scale-95"
                aria-label={`Hapus ${m.name}`}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2 p-2 pt-1">
        <input
          className="min-h-11 flex-1 rounded-xl border border-outline bg-surface px-3 text-sm focus:border-primary focus:outline-none"
          placeholder="Tambah merchant..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !newName.trim()}
          className="flex min-h-11 items-center gap-1 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-card transition active:scale-[0.98] disabled:opacity-50"
        >
          <Plus size={16} />
        </button>
      </div>
    </GroupCard>
  );
}

const TYPE_DEFAULT_COLOR: Record<string, string> = {
  expense: "#EF4444",
  income: "#10B981"
};

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "expense", label: "Pengeluaran" },
  { value: "income", label: "Pemasukan" }
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));

function CategoryRow({
  c,
  actionable,
  onRemove
}: {
  c: CategoryItem;
  actionable: boolean;
  onRemove?: (id: string, name: string) => void;
}) {
  const Icon = getCategoryIcon(c.icon);
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-surface-low">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
        style={{ backgroundColor: c.color ?? TYPE_DEFAULT_COLOR[c.type] ?? "#6366F1" }}
      >
        <Icon size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-ink">{c.name}</p>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{TYPE_LABEL[c.type] ?? c.type}</p>
      </div>
      {actionable && onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(c.id, c.name)}
          className="flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-expense/10 hover:text-expense active:scale-95"
          aria-label={`Hapus ${c.name}`}
        >
          <Trash2 size={15} />
        </button>
      ) : null}
    </div>
  );
}

function UserCategorySection({ onStatus }: { onStatus: (s: string) => void }) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("expense");
  const [newIcon, setNewIcon] = useState("tag");
  const [newColor, setNewColor] = useState(TYPE_DEFAULT_COLOR.expense);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
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

  async function load() {
    const res = await fetch("/api/categories");
    if (res.ok) setCategories(((await res.json()).categories ?? []) as CategoryItem[]);
  }

  useEffect(() => { void load(); }, []);

  function openSheet() {
    setNewName("");
    setNewType("expense");
    setNewIcon("tag");
    setNewColor(TYPE_DEFAULT_COLOR.expense);
    setIconOpen(false);
    setSheetOpen(true);
  }

  function handleTypeChange(next: string) {
    setNewType(next);
    setNewColor(TYPE_DEFAULT_COLOR[next] ?? TYPE_DEFAULT_COLOR.expense);
  }

  async function add() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          type: newType,
          icon: newIcon,
          color: newColor
        })
      });
      if (res.ok) {
        await load();
        onStatus("Kategori ditambahkan.");
        setSheetOpen(false);
      } else {
        const d = await res.json().catch(() => null);
        onStatus(d?.error ?? "Gagal tambah kategori.");
      }
    } finally { setBusy(false); }
  }

  function remove(id: string, name: string) {
    setConfirm({
      title: "Hapus Kategori",
      message: `"${name}" akan dihapus secara permanen.`,
      confirmLabel: "Ya, Hapus",
      onConfirm: async () => {
        const res = await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
        if (res.ok) { await load(); onStatus("Kategori dihapus."); }
        else onStatus("Gagal hapus kategori.");
      }
    });
  }

  const [showSystemCats, setShowSystemCats] = useState(false);
  const systemCategories = categories.filter((c) => c.is_system);
  const ownCategories = categories.filter((c) => !c.is_system);

  const SelectedIcon = getCategoryIcon(newIcon);
  const selectedIconLabel = getCategoryIconLabel(newIcon);

  return (
    <GroupCard
      icon={List}
      title="Kategori"
      subtitle={`${ownCategories.length} kategori pribadi`}
      action={
        <button
          type="button"
          onClick={openSheet}
          className="flex min-h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-bold text-white shadow-card transition active:scale-95"
        >
          <Plus size={14} /> Tambah
        </button>
      }
    >
      {confirm ? <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} /> : null}

      {systemCategories.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowSystemCats((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold text-muted transition hover:bg-surface-container"
        >
          <span>Kategori global ({systemCategories.length})</span>
          <ChevronDown size={14} className={`transition-transform ${showSystemCats ? "rotate-180" : ""}`} />
        </button>
      ) : null}

      {showSystemCats ? (
        <ul className="space-y-1 pb-1">
          {systemCategories.map((c) => (
            <li key={c.id}>
              <CategoryRow c={c} actionable={false} />
            </li>
          ))}
        </ul>
      ) : null}

      {ownCategories.length > 0 ? (
        <ul className="space-y-1 pb-1">
          {ownCategories.map((c) => (
            <li key={c.id}>
              <CategoryRow c={c} actionable onRemove={remove} />
            </li>
          ))}
        </ul>
      ) : (
        !showSystemCats ? (
          <p className="px-3 py-3 text-xs text-muted">Belum ada kategori pribadi. Tap “Tambah” untuk membuat pertama.</p>
        ) : null
      )}

      {sheetOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 backdrop-blur-sm md:items-center"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="animate-sheet-up w-full max-w-md rounded-t-3xl bg-surface pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-lift md:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-center pt-3">
              <span className="h-1.5 w-10 rounded-full bg-outline" aria-hidden="true" />
            </div>

            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <div>
                <h2 className="text-lg font-black text-ink">Kategori Baru</h2>
                <p className="text-xs text-muted">Isi detail kategori pribadi</p>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="flex size-9 items-center justify-center rounded-full bg-surface-container text-muted transition active:scale-95"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[72dvh] space-y-4 overflow-y-auto px-5 pb-2 pt-1">
              {/* Live preview chip */}
              <div
                className="flex items-center gap-3 rounded-2xl p-4 text-white shadow-card"
                style={{ background: `linear-gradient(135deg, ${newColor}, ${newColor}cc)` }}
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/20">
                  <SelectedIcon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{newName.trim() || "Nama kategori"}</p>
                  <p className="text-[11px] uppercase tracking-wider text-white/80">{TYPE_LABEL[newType]}</p>
                </div>
              </div>

              {/* Type selector — segmented */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Tipe</span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map((opt) => {
                    const active = newType === opt.value;
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
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Nama</span>
                <input
                  className="mt-2 min-h-12 w-full rounded-xl border border-outline bg-surface px-4 text-ink focus:border-primary focus:outline-none"
                  placeholder="cth. Makan Siang"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  autoFocus
                />
              </label>

              {/* Icon picker */}
              <div className="relative" ref={iconRef}>
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
                    style={{ backgroundColor: newColor }}
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
                      const selected = newIcon === option.value;
                      return (
                        <li key={option.value} role="option" aria-selected={selected}>
                          <button
                            type="button"
                            onClick={() => { setNewIcon(option.value); setIconOpen(false); }}
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

              {/* Color — swatches + custom */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Warna</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[...new Set([...Object.values(TYPE_DEFAULT_COLOR), "#1668DC", "#F59E0B", "#8B5CF6", "#EC4899", "#0EA5E9", "#14B8A6"])]
                    .map((color) => {
                      const active = newColor.toLowerCase() === color.toLowerCase();
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewColor(color)}
                          className={`size-9 rounded-full border-2 transition active:scale-90 ${active ? "border-ink" : "border-transparent"}`}
                          style={{ backgroundColor: color }}
                          aria-label={`Pilih warna ${color}`}
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
                    value={/^#[0-9A-Fa-f]{6}$/.test(newColor) ? newColor : "#1668DC"}
                    onChange={(event) => setNewColor(event.target.value)}
                  />
                  <input
                    className="min-h-10 flex-1 rounded-lg border border-outline bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                    value={newColor}
                    onChange={(event) => setNewColor(event.target.value)}
                    placeholder="#EF4444"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={add}
                disabled={busy || !newName.trim()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-white shadow-card transition active:scale-[0.98] disabled:opacity-50"
              >
                <Plus size={18} />
                {busy ? "Menyimpan..." : "Simpan Kategori"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </GroupCard>
  );
}
