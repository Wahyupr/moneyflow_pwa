"use client";

import { Store, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";

type AdminUser = {
  id: string;
  display_name: string | null;
  role: "user" | "admin";
  default_currency: string;
  created_at: string;
  entitlement: { plan: "free" | "premium"; status: string; current_period_end: string | null };
};

type AdminMerchant = {
  id: string;
  name: string;
  logo_url: string | null;
  is_system: boolean;
  created_at: string;
};

export default function AdminPage() {
  return (
    <AppFrame title="Admin" subtitle="Kelola user & merchant">
      <AdminContent />
    </AppFrame>
  );
}

function AdminContent() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [merchants, setMerchants] = useState<AdminMerchant[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [merchantName, setMerchantName] = useState("");
  const [merchantLogo, setMerchantLogo] = useState("");

  const load = useCallback(async () => {
    const [usersRes, merchantsRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/merchants")
    ]);

    if (usersRes.status === 403 || merchantsRes.status === 403) {
      setForbidden(true);
      return;
    }

    if (usersRes.ok) {
      setUsers((await usersRes.json()).users ?? []);
    }
    if (merchantsRes.ok) {
      setMerchants((await merchantsRes.json()).merchants ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updatePlan(userId: string, plan: "free" | "premium") {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId, plan })
    });
    setStatus(response.ok ? "Subscription diperbarui." : "Gagal memperbarui subscription.");
    if (response.ok) {
      void load();
    }
  }

  async function addMerchant() {
    if (!merchantName.trim()) {
      setStatus("Nama merchant wajib diisi.");
      return;
    }

    const response = await fetch("/api/admin/merchants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: merchantName, logo_url: merchantLogo })
    });

    if (response.ok) {
      setMerchantName("");
      setMerchantLogo("");
      setStatus("Merchant ditambahkan.");
      void load();
    } else {
      setStatus("Gagal menambahkan merchant.");
    }
  }

  if (forbidden) {
    return (
      <div className="mt-6 rounded-xl bg-surface p-5 text-center shadow-card">
        <p className="font-bold text-ink">Akses ditolak</p>
        <p className="mt-2 text-sm text-muted">Halaman ini hanya untuk admin.</p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-xl bg-surface p-4 shadow-card">
        <SectionTitle icon={Store} title="Tambah Merchant" subtitle="Merchant global (Netflix, dll)" />
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-muted">Nama merchant</span>
          <input
            className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
            value={merchantName}
            onChange={(event) => setMerchantName(event.target.value)}
            placeholder="Netflix"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-sm font-semibold text-muted">URL logo</span>
          <input
            className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
            value={merchantLogo}
            onChange={(event) => setMerchantLogo(event.target.value)}
            placeholder="https://.../netflix.png"
          />
        </label>
        <button className="mt-4 min-h-12 w-full rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98]" onClick={addMerchant} type="button">
          Tambah Merchant
        </button>

        {merchants.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {merchants.map((merchant) => (
              <li className="flex items-center gap-3 rounded-lg border border-outline p-2" key={merchant.id}>
                {merchant.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={merchant.name} className="size-8 rounded-md object-cover" src={merchant.logo_url} />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-md bg-surface-container text-primary">
                    <Store size={16} />
                  </span>
                )}
                <span className="font-semibold text-ink">{merchant.name}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-xl bg-surface p-4 shadow-card">
        <SectionTitle icon={UserRound} title="User & Subscription" subtitle="Kelola plan user" />
        <ul className="mt-4 space-y-2">
          {users.map((user) => (
            <li className="rounded-lg border border-outline p-3" key={user.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{user.display_name ?? "Tanpa nama"}</p>
                  <p className="text-xs text-muted">
                    {user.role} · {user.entitlement.plan} ({user.entitlement.status})
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="min-h-9 rounded-lg bg-surface-container px-3 text-xs font-bold text-primary active:scale-[0.98]"
                    onClick={() => updatePlan(user.id, "free")}
                    type="button"
                  >
                    Free
                  </button>
                  <button
                    className="min-h-9 rounded-lg bg-secondary px-3 text-xs font-bold text-white active:scale-[0.98]"
                    onClick={() => updatePlan(user.id, "premium")}
                    type="button"
                  >
                    Premium
                  </button>
                </div>
              </div>
            </li>
          ))}
          {users.length === 0 ? <li className="text-sm text-muted">Belum ada user.</li> : null}
        </ul>
      </section>

      {status ? <p className="rounded-lg bg-surface-container p-3 text-sm font-semibold text-primary">{status}</p> : null}
    </div>
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
