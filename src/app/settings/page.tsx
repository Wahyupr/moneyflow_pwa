"use client";

import {
  Bell,
  LogOut,
  Pencil,
  Save,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { MerchantManager } from "@/components/merchant-manager";

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
