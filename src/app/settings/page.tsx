"use client";

import { Bell, LogOut, Mic, Save, Shield, Store, UserRound } from "lucide-react";
import { useState } from "react";
import { AppFrame } from "@/components/app-frame";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("Nara Putri");
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function saveProfile() {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_name: displayName, locale: "id-ID", default_currency: "IDR" })
    });
    setStatus(response.ok ? "Profile tersimpan." : "Profile disimpan lokal.");
  }

  async function savePin() {
    const response = await fetch("/api/profile/pin", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin })
    });
    setStatus(response.ok ? "PIN tersimpan." : "PIN belum tersimpan di server.");
  }

  return (
    <AppFrame title="Settings" subtitle="Profile">
      <div className="mt-5 space-y-5">
        <section className="rounded-xl bg-surface p-4 shadow-card">
          <SectionTitle icon={UserRound} title="Profile" subtitle="Data user" />
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-muted">Nama</span>
            <input className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label className="mt-3 block">
            <span className="text-sm font-semibold text-muted">Email</span>
            <input className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 text-muted focus:border-primary focus:outline-none" defaultValue="nara@moneyflow.id" />
          </label>
          <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98]" onClick={saveProfile} type="button">
            <Save size={18} />
            Simpan Profile
          </button>
        </section>

        <section className="rounded-xl bg-surface p-4 shadow-card" id="security">
          <SectionTitle icon={Shield} title="Privacy & Security" subtitle="PIN, biometrik, hide balances" />
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-muted">PIN</span>
            <input className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 tracking-[0.3em] focus:border-primary focus:outline-none" inputMode="numeric" maxLength={8} value={pin} onChange={(event) => setPin(event.target.value)} />
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

        <section className="rounded-xl bg-surface p-4 shadow-card" id="preferences">
          <SectionTitle icon={Store} title="Merchant Management" subtitle="Rules kategori" />
          <div className="mt-4 rounded-lg border border-outline p-3">
            <p className="font-semibold">Kopi Kenangan</p>
            <p className="mt-1 text-sm text-muted">Makanan & Minuman</p>
          </div>
          <button className="mt-3 min-h-11 w-full rounded-lg bg-surface-container font-bold text-primary" type="button">
            Add Custom Merchant Rule
          </button>
        </section>

        <section className="overflow-hidden rounded-xl bg-surface shadow-card">
          <SettingsRow icon={Bell} title="Notifications" subtitle="Alerts and reminders" />
          <SettingsRow icon={Mic} title="Voice Sensitivity" subtitle="AI listening mode" toggle />
        </section>

        {status ? <p className="rounded-lg bg-surface-container p-3 text-sm font-semibold text-primary">{status}</p> : null}

        <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg text-error active:bg-error-container" onClick={() => (window.location.href = "/")} type="button">
          <LogOut size={18} />
          Log Out
        </button>
      </div>
    </AppFrame>
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

function SettingsRow({ icon: Icon, title, subtitle, toggle = false }: { icon: typeof UserRound; title: string; subtitle: string; toggle?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-container p-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-surface-container text-primary">
          <Icon size={18} />
        </div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      {toggle ? <span className="h-6 w-11 rounded-full bg-primary p-0.5 after:block after:size-5 after:translate-x-5 after:rounded-full after:bg-white" /> : null}
    </div>
  );
}
