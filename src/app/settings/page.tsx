"use client";

import { Bell, ChevronDown, List, LogOut, Plus, Save, Store, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { MerchantManager } from "@/components/merchant-manager";
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog";
import { SelectMenu } from "@/components/ui/select-menu";
import { CATEGORY_ICON_OPTIONS, getCategoryIcon, getCategoryIconLabel } from "@/lib/category-icons";


type ProfilePayload = {
  user?: { email?: string | null };
  profile?: { display_name?: string | null; role?: "user" | "admin" | null; hide_nominal_default?: boolean | null };
  entitlement?: { plan?: string | null };
};

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveProfile() {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_name: displayName, locale: "id-ID", default_currency: "IDR" })
    });
    setStatus(response.ok ? "Profile tersimpan." : "Gagal menyimpan profile.");
  }

  return (
    <AppFrame title="Settings" subtitle="Pengaturan">
      <div className="mt-5 space-y-5">
        <section className="rounded-xl bg-surface p-4 shadow-card">
          <SectionTitle icon={UserRound} title="Profile" subtitle="Data user" />
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-muted">Nama</span>
            <input
              className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={loading ? "Memuat..." : "Nama kamu"}
            />
          </label>
          <label className="mt-3 block">
            <span className="text-sm font-semibold text-muted">Email</span>
            <input
              className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 text-muted focus:border-primary focus:outline-none"
              value={email}
              readOnly
            />
          </label>
          <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98]" onClick={saveProfile} type="button">
            <Save size={18} />
            Simpan Profile
          </button>
        </section>


        {/* User-level merchant management */}
        <UserMerchantSection onStatus={setStatus} />

        {/* User-level category management */}
        <UserCategorySection onStatus={setStatus} />

        {role === "admin" ? (
          <>
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-xl bg-surface p-4 shadow-card active:scale-[0.99]"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-surface-container text-primary">
                <Store size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">Panel Admin</p>
                <p className="text-sm text-muted">Kelola merchant, kategori &amp; user</p>
              </div>
            </Link>
            <MerchantManager onStatus={setStatus} />
          </>
        ) : null}


        <section className="overflow-hidden rounded-xl bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-surface-container p-4 last:border-b-0">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-surface-container text-primary">
                <Bell size={18} />
              </div>
              <div>
                <p className="font-semibold">Notifications</p>
                <p className="text-sm text-muted">Reminder dan alert</p>
              </div>
            </div>
          </div>
        </section>

        {status ? <p className="rounded-lg bg-surface-container p-3 text-sm font-semibold text-primary">{status}</p> : null}

        <button
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-expense font-bold text-white active:scale-[0.98] active:brightness-90"
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
      </div>
    </AppFrame>
  );
}

type MerchantItem = { id: string; name: string; is_system: boolean; logo_url: string | null };
type CategoryItem = { id: string; name: string; type: string; icon: string | null; color: string | null; is_system: boolean; user_id: string | null };

function UserMerchantSection({ onStatus }: { onStatus: (s: string) => void }) {
  const [merchants, setMerchants] = useState<MerchantItem[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

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
      if (res.ok) { setNewName(""); await load(); onStatus("Merchant ditambahkan."); }
      else { const d = await res.json().catch(() => null); onStatus(d?.error ?? "Gagal tambah merchant."); }
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

  const [showSystem, setShowSystem] = useState(false);
  const systemMerchants = merchants.filter((m) => m.is_system);
  const ownMerchants = merchants.filter((m) => !m.is_system);

  return (
    <section className="rounded-xl bg-surface p-4 shadow-card">
      {confirm ? <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} /> : null}
      <SectionTitle icon={Store} title="Merchant" subtitle="Kelola merchant" />
      <div className="mt-4 space-y-2">
        {/* System merchants — collapsible */}
        {systemMerchants.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowSystem((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-container"
          >
            <span>Merchant global ({systemMerchants.length})</span>
            <ChevronDown size={14} className={`transition-transform ${showSystem ? "rotate-180" : ""}`} />
          </button>
        ) : null}
        {showSystem
          ? systemMerchants.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-sm">
                {m.logo_url ? <img src={m.logo_url} alt="" className="size-5 rounded-full object-cover" /> : null}
                <span className="flex-1 font-semibold text-ink">{m.name}</span>
              </div>
            ))
          : null}
        {ownMerchants.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-sm">
            {m.logo_url ? <img src={m.logo_url} alt="" className="size-5 rounded-full object-cover" /> : null}
            <span className="flex-1 font-semibold text-ink">{m.name}</span>
            <button type="button" onClick={() => remove(m.id, m.name)} className="text-muted hover:text-expense">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="min-h-10 flex-1 rounded-lg border border-outline bg-surface px-3 text-sm focus:border-primary focus:outline-none"
          placeholder="Nama merchant baru"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
        />
        <button type="button" onClick={add} disabled={busy || !newName.trim()} className="flex min-h-10 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-bold text-white disabled:opacity-60">
          <Plus size={16} /> Tambah
        </button>
      </div>
    </section>
  );
}

const TYPE_DEFAULT_COLOR: Record<string, string> = {
  expense: "#EF4444",
  income: "#10B981",
  transfer: "#6366F1"
};

function UserCategorySection({ onStatus }: { onStatus: (s: string) => void }) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
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

  function handleTypeChange(next: string) {
    setNewType(next);
    // Sync color to the type's default so the chip matches the user's intent.
    // If they want a different color they can override it in the color picker.
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
        setNewName("");
        setNewIcon("tag");
        setNewColor(TYPE_DEFAULT_COLOR[newType] ?? TYPE_DEFAULT_COLOR.expense);
        await load();
        onStatus("Kategori ditambahkan.");
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

  const TYPE_LABEL: Record<string, string> = { expense: "Pengeluaran", income: "Pemasukan", transfer: "Transfer" };
  const TYPE_COLOR: Record<string, string> = {
    expense: "bg-expense/10 text-expense",
    income: "bg-income/10 text-income",
    transfer: "bg-transfer/10 text-transfer"
  };

  const [showSystemCats, setShowSystemCats] = useState(false);
  const systemCategories = categories.filter((c) => c.is_system);
  const ownCategories = categories.filter((c) => !c.is_system);

  const SelectedIcon = getCategoryIcon(newIcon);
  const selectedIconLabel = getCategoryIconLabel(newIcon);

  function renderChip(c: CategoryItem) {
    const Icon = getCategoryIcon(c.icon);
    return (
      <div key={c.id} className="flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-sm">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: c.color ?? TYPE_DEFAULT_COLOR[c.type] ?? "#6366F1" }}>
          <Icon size={14} aria-hidden="true" />
        </span>
        <span className="flex-1 truncate font-semibold text-ink">{c.name}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_COLOR[c.type] ?? "bg-surface-container text-muted"}`}>{TYPE_LABEL[c.type] ?? c.type}</span>
      </div>
    );
  }

  return (
    <section className="rounded-xl bg-surface p-4 shadow-card">
      {confirm ? <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} /> : null}
      <SectionTitle icon={List} title="Kategori" subtitle="Kelola kategori" />
      <div className="mt-4 space-y-2">
        {/* System categories — collapsible */}
        {systemCategories.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowSystemCats((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-container"
          >
            <span>Kategori global ({systemCategories.length})</span>
            <ChevronDown size={14} className={`transition-transform ${showSystemCats ? "rotate-180" : ""}`} />
          </button>
        ) : null}
        {showSystemCats ? systemCategories.map(renderChip) : null}
        {ownCategories.map((c) => {
          const chip = renderChip(c);
          return (
            <div key={c.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">{chip}</div>
              <button type="button" onClick={() => remove(c.id, c.name)} className="text-muted hover:text-expense" aria-label={`Hapus ${c.name}`}>
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 space-y-2">
        <SelectMenu
          ariaLabel="Tipe kategori"
          value={newType}
          onChange={handleTypeChange}
          options={[{ value: "expense", label: "Pengeluaran" }, { value: "income", label: "Pemasukan" }, { value: "transfer", label: "Transfer" }]}
        />

        <div className="relative" ref={iconRef}>
          <span className="block text-xs font-semibold text-muted">Ikon</span>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={iconOpen}
            onClick={() => setIconOpen((open) => !open)}
            className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-lg border border-outline bg-surface px-3 text-left text-sm focus:border-primary focus:outline-none"
          >
            <span className="text-primary">
              <SelectedIcon size={16} />
            </span>
            <span className="flex-1 truncate text-ink">{selectedIconLabel}</span>
            <ChevronDown size={16} className={`shrink-0 text-muted transition ${iconOpen ? "rotate-180" : ""}`} />
          </button>
          {iconOpen ? (
            <ul role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-outline bg-surface py-1 shadow-lift">
              {CATEGORY_ICON_OPTIONS.map((option) => {
                const OptionIcon = option.Icon;
                const selected = newIcon === option.value;
                return (
                  <li key={option.value} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => { setNewIcon(option.value); setIconOpen(false); }}
                      className={`flex min-h-9 w-full items-center gap-3 px-3 text-left text-sm transition ${selected ? "bg-primary-container/15 font-semibold text-primary" : "text-ink hover:bg-surface-container"}`}
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

        <label className="block">
          <span className="text-xs font-semibold text-muted">Warna</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              aria-label="Pilih warna kategori"
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
        </label>

        <div className="flex gap-2">
          <input
            className="min-h-10 flex-1 rounded-lg border border-outline bg-surface px-3 text-sm focus:border-primary focus:outline-none"
            placeholder="Nama kategori baru"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
          />
          <button type="button" onClick={add} disabled={busy || !newName.trim()} className="flex min-h-10 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-bold text-white disabled:opacity-60">
            <Plus size={16} /> Tambah
          </button>
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: typeof UserRound; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-full bg-surface-container text-primary">
        <Icon size={18} />
      </div>
      <div>
        <h2 className="font-bold text-ink">{title}</h2>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
    </div>
  );
}
