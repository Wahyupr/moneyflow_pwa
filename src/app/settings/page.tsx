"use client";

import { Bell, List, LogOut, Plus, Save, Shield, Store, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { MerchantManager } from "@/components/merchant-manager";
import { SelectMenu } from "@/components/ui/select-menu";


type ProfilePayload = {
  user?: { email?: string | null };
  profile?: { display_name?: string | null; role?: "user" | "admin" | null; hide_nominal_default?: boolean | null };
  entitlement?: { plan?: string | null };
};

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [pin, setPin] = useState("");
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

  async function savePin() {
    const response = await fetch("/api/profile/pin", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin })
    });
    setStatus(response.ok ? "PIN tersimpan." : "PIN gagal disimpan (4-8 digit).");
    if (response.ok) {
      setPin("");
    }
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

        <section className="rounded-xl bg-surface p-4 shadow-card" id="security">
          <SectionTitle icon={Shield} title="PIN & Security" subtitle="PIN, biometrik, privacy mode" />
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-muted">PIN</span>
            <input
              className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 tracking-[0.3em] focus:border-primary focus:outline-none"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="min-h-12 rounded-lg bg-secondary px-4 font-bold text-white active:scale-[0.98]" onClick={savePin} type="button">
              Set PIN
            </button>
            <button
              className="min-h-12 rounded-lg bg-surface-container px-4 font-bold text-primary active:scale-[0.98]"
              onClick={() => fetch("/api/profile/pin", { method: "DELETE" }).finally(() => setStatus("PIN dihapus."))}
              type="button"
            >
              Hapus PIN
            </button>
          </div>
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
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg text-error active:bg-error-container"
          onClick={() => {
            fetch("/api/auth/logout", { method: "POST" }).finally(() => {
              window.location.href = "/";
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
type CategoryItem = { id: string; name: string; type: string; is_system: boolean; user_id: string | null };

function UserMerchantSection({ onStatus }: { onStatus: (s: string) => void }) {
  const [merchants, setMerchants] = useState<MerchantItem[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function remove(id: string) {
    if (!window.confirm("Hapus merchant ini?")) return;
    const res = await fetch(`/api/merchants?id=${id}`, { method: "DELETE" });
    if (res.ok) { await load(); onStatus("Merchant dihapus."); }
    else onStatus("Gagal hapus merchant.");
  }

  const own = merchants.filter((m) => !m.is_system);
  const system = merchants.filter((m) => m.is_system);

  return (
    <section className="rounded-xl bg-surface p-4 shadow-card">
      <SectionTitle icon={Store} title="Merchant Saya" subtitle="Merchant pribadi & global" />
      <div className="mt-4 space-y-2">
        {system.length > 0 ? (
          <p className="text-xs font-semibold text-muted">GLOBAL (dari admin)</p>
        ) : null}
        {system.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-sm">
            {m.logo_url ? <img src={m.logo_url} alt="" className="size-5 rounded-full object-cover" /> : null}
            <span className="flex-1 font-semibold text-ink">{m.name}</span>
            <span className="text-xs text-muted">global</span>
          </div>
        ))}
        {own.length > 0 ? (
          <p className="mt-3 text-xs font-semibold text-muted">MILIKKU</p>
        ) : null}
        {own.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-sm">
            <span className="flex-1 font-semibold text-ink">{m.name}</span>
            <button type="button" onClick={() => remove(m.id)} className="text-muted hover:text-expense">
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

function UserCategorySection({ onStatus }: { onStatus: (s: string) => void }) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("expense");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/categories");
    if (res.ok) setCategories(((await res.json()).categories ?? []) as CategoryItem[]);
  }

  useEffect(() => { void load(); }, []);

  async function add() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), type: newType })
      });
      if (res.ok) { setNewName(""); await load(); onStatus("Kategori ditambahkan."); }
      else { const d = await res.json().catch(() => null); onStatus(d?.error ?? "Gagal tambah kategori."); }
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Hapus kategori ini?")) return;
    const res = await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
    if (res.ok) { await load(); onStatus("Kategori dihapus."); }
    else onStatus("Gagal hapus kategori.");
  }

  const TYPE_LABEL: Record<string, string> = { expense: "Pengeluaran", income: "Pemasukan", transfer: "Transfer" };
  const own = categories.filter((c) => !c.is_system);
  const system = categories.filter((c) => c.is_system);

  return (
    <section className="rounded-xl bg-surface p-4 shadow-card">
      <SectionTitle icon={List} title="Kategori Saya" subtitle="Kategori pribadi & global" />
      <div className="mt-4 space-y-2">
        {system.length > 0 ? (
          <p className="text-xs font-semibold text-muted">GLOBAL (dari admin)</p>
        ) : null}
        {system.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-sm">
            <span className="flex-1 font-semibold text-ink">{c.name}</span>
            <span className="text-xs text-muted">{TYPE_LABEL[c.type] ?? c.type}</span>
            <span className="text-xs text-muted">global</span>
          </div>
        ))}
        {own.length > 0 ? (
          <p className="mt-3 text-xs font-semibold text-muted">MILIKKU</p>
        ) : null}
        {own.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-sm">
            <span className="flex-1 font-semibold text-ink">{c.name}</span>
            <span className="text-xs text-muted">{TYPE_LABEL[c.type] ?? c.type}</span>
            <button type="button" onClick={() => remove(c.id)} className="text-muted hover:text-expense">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        <SelectMenu
          ariaLabel="Tipe kategori"
          value={newType}
          onChange={setNewType}
          options={[{ value: "expense", label: "Pengeluaran" }, { value: "income", label: "Pemasukan" }, { value: "transfer", label: "Transfer" }]}
        />
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
