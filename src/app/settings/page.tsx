"use client";

import { Bell, LogOut, Save, Shield, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { MerchantManager } from "@/components/merchant-manager";

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

        {role === "admin" ? <MerchantManager onStatus={setStatus} /> : null}

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
