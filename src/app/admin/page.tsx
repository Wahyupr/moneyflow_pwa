"use client";

import { UserRound, Settings2, Infinity, CreditCard } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppFrame } from "@/components/app-frame";
import { CategoryManager } from "@/components/category-manager";
import { MerchantManager } from "@/components/merchant-manager";
import { Toast, useToast } from "@/components/ui/toast";


// ─── Plan limits types ───────────────────────────────────────────────────────
type PlanRow = {
  plan: "free" | "premium" | "pro";
  wallets: number | null;
  active_budgets: number | null;
  history_months: number | null;
  voice_per_day: number | null;
  scan_per_day: number | null;
  export_per_month: number | null;
  ai_insights_per_month: number | null;
  debt_records: number | null;
  shared_wallets: number | null;
  reminders: number | null;
  custom_merchants: number | null;
  custom_categories: number | null;
  ai_chat: boolean;
  updated_at: string;
};

type AdminUser = {
  id: string;
  display_name: string | null;
  role: "user" | "admin";
  default_currency: string;
  created_at: string;
  entitlement: { plan: "free" | "premium" | "pro"; status: string; current_period_end: string | null };
};

type Entitlement = AdminUser["entitlement"];

/** True if the entitlement has a non-null period_end that has already passed. */
function isExpired(e: Entitlement): boolean {
  return e.current_period_end !== null && new Date(e.current_period_end) <= new Date();
}

/** Returns the effective plan, downgrading to "free" if the trial/period has expired. */
function effectivePlan(e: Entitlement): "free" | "premium" | "pro" {
  return isExpired(e) ? "free" : e.plan;
}

export default function AdminPage() {
  return (
    <AppFrame title="Admin" subtitle="Kelola user & merchant">
      <AdminContent />
    </AppFrame>
  );
}

// ─── Field metadata for the limits editor ────────────────────────────────────
const LIMIT_FIELDS: Array<{
  key: keyof Omit<PlanRow, "plan" | "ai_chat" | "updated_at">;
  label: string;
  unit?: string;
}> = [
  { key: "wallets",               label: "Dompet",                unit: "dompet" },
  { key: "active_budgets",        label: "Budget aktif",          unit: "budget" },
  { key: "history_months",        label: "Riwayat transaksi",     unit: "bulan" },
  { key: "voice_per_day",         label: "Voice AI / hari",       unit: "kali" },
  { key: "scan_per_day",          label: "Scan struk AI / hari",  unit: "kali" },
  { key: "export_per_month",      label: "Ekspor / bulan",        unit: "kali" },
  { key: "ai_insights_per_month", label: "AI Insights / bulan",   unit: "kali" },
  { key: "debt_records",          label: "Hutang & Piutang",      unit: "catatan" },
  { key: "shared_wallets",        label: "Dompet bersama",        unit: "dompet" },
  { key: "reminders",             label: "Pengingat tagihan",     unit: "item" },
  { key: "custom_merchants",      label: "Merchant kustom",       unit: "item" },
  { key: "custom_categories",     label: "Kategori kustom",       unit: "item" },
];

const PLAN_COLORS: Record<string, string> = {
  free:    "bg-outline/60 text-ink",
  premium: "bg-primary text-white",
  pro:     "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
};

function AdminContent() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const { toast, showToast } = useToast();

  const [limits, setLimits] = useState<PlanRow[]>([]);
  const [editingPlan, setEditingPlan] = useState<"free" | "premium" | "pro" | null>(null);
  const [editValues, setEditValues] = useState<Partial<Record<string, string>>>({});

  const loadUsers = useCallback(async () => {
    const usersRes = await fetch("/api/admin/users");
    if (usersRes.status === 403) {
      setForbidden(true);
      return;
    }
    if (usersRes.ok) {
      setUsers((await usersRes.json()).users ?? []);
    }
  }, []);

  const loadLimits = useCallback(async () => {
    const res = await fetch("/api/admin/plan-limits");
    if (res.ok) {
      setLimits((await res.json()).limits ?? []);
    }
  }, []);

  // status is kept for backward compat with MerchantManager / CategoryManager callbacks
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    if (status) {
      showToast(status, status.startsWith("Gagal") ? "error" : "success");
      setStatus(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    void loadUsers();
    void loadLimits();
  }, [loadUsers, loadLimits]);

  function startEdit(plan: "free" | "premium" | "pro") {
    const row = limits.find((l) => l.plan === plan);
    if (!row) return;
    const vals: Record<string, string> = { ai_chat: String(row.ai_chat) };
    for (const { key } of LIMIT_FIELDS) {
      vals[key] = row[key] === null ? "" : String(row[key]);
    }
    setEditValues(vals);
    setEditingPlan(plan);
  }

  async function saveLimits() {
    if (!editingPlan) return;
    const payload: Record<string, unknown> = { plan: editingPlan };
    for (const { key } of LIMIT_FIELDS) {
      const raw = editValues[key];
      payload[key] = raw === "" || raw === undefined ? null : Number(raw);
    }
    payload.ai_chat = editValues.ai_chat === "true";

    const res = await fetch("/api/admin/plan-limits", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      showToast(`Limit paket ${editingPlan} disimpan.`, "success");
      setEditingPlan(null);
      void loadLimits();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(`Gagal menyimpan: ${err.error ?? "error tidak diketahui"}`, "error");
    }
  }

  async function updatePlan(userId: string, plan: "free" | "premium" | "pro") {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId, plan })
    });
    if (response.ok) {
      showToast("Subscription diperbarui.", "success");
      void loadUsers();
    } else {
      showToast("Gagal memperbarui subscription.", "error");
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
      <Toast toast={toast} />

      {/* ── Quick nav ── */}
      <Link
        href="/admin/payments"
        className="flex items-center gap-3 rounded-xl bg-surface p-4 shadow-card transition hover:shadow-lift active:scale-[0.99]"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CreditCard size={18} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-ink">Riwayat Pembayaran</p>
          <p className="text-sm text-muted">Lihat semua transaksi & pendapatan</p>
        </div>
        <svg className="size-4 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      <MerchantManager onStatus={setStatus} />

      <CategoryManager onStatus={setStatus} />

      {/* ── Plan Limits Manager ── */}
      <section className="rounded-xl bg-surface p-4 shadow-card">
        <SectionTitle icon={Settings2} title="Pengaturan Limit Plan" subtitle="Edit batas fitur per paket" />

        <div className="mt-4 space-y-3">
          {(["free", "premium", "pro"] as const).map((plan) => {
            const row = limits.find((l) => l.plan === plan);
            const isEditing = editingPlan === plan;

            return (
              <div key={plan} className="rounded-xl border border-outline bg-surface-container p-3">
                {/* Plan header */}
                <div className="mb-3 flex items-center justify-between">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${PLAN_COLORS[plan]}`}>
                    {plan}
                  </span>
                  {!isEditing ? (
                    <button
                      type="button"
                      className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                      onClick={() => startEdit(plan)}
                    >
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-outline/30"
                        onClick={() => setEditingPlan(null)}
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary/90"
                        onClick={() => void saveLimits()}
                      >
                        Simpan
                      </button>
                    </div>
                  )}
                </div>

                {/* Fields grid */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {LIMIT_FIELDS.map(({ key, label, unit }) => {
                    const rawVal = row ? row[key] : null;
                    return (
                      <div key={key} className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-medium text-muted">{label}</span>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              placeholder="∞"
                              value={editValues[key] ?? ""}
                              onChange={(e) =>
                                setEditValues((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              className="w-full rounded-md border border-outline bg-surface px-2 py-1 text-xs text-ink placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            {unit && <span className="shrink-0 text-[10px] text-muted">{unit}</span>}
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-sm font-semibold text-ink">
                            {rawVal === null ? (
                              <><Infinity size={14} className="text-income" /> <span className="text-income text-xs">∞</span></>
                            ) : (
                              <>{rawVal} <span className="text-[10px] font-normal text-muted">{unit}</span></>
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* AI Chat boolean */}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-muted">AI Chat</span>
                    {isEditing ? (
                      <select
                        value={editValues.ai_chat ?? "false"}
                        onChange={(e) =>
                          setEditValues((prev) => ({ ...prev, ai_chat: e.target.value }))
                        }
                        className="rounded-md border border-outline bg-surface px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="false">Tidak aktif</option>
                        <option value="true">Aktif</option>
                      </select>
                    ) : (
                      <span className={`text-sm font-semibold ${row?.ai_chat ? "text-income" : "text-muted"}`}>
                        {row?.ai_chat ? "Aktif" : "Tidak"}
                      </span>
                    )}
                  </div>
                </div>

                {row && (
                  <p className="mt-2 text-[10px] text-muted/60">
                    Terakhir diubah: {new Date(row.updated_at).toLocaleString("id-ID")}
                  </p>
                )}
              </div>
            );
          })}

          {limits.length === 0 && (
            <p className="text-sm text-muted">
              Tabel plan_limits belum dibuat. Jalankan migrasi terlebih dahulu.
            </p>
          )}
        </div>
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
                    {user.role} · {effectivePlan(user.entitlement)} ({user.entitlement.status})
                    {isExpired(user.entitlement) && (
                      <span className="ml-1.5 rounded bg-expense/15 px-1.5 py-0.5 text-[10px] font-bold text-expense">
                        expired → free
                      </span>
                    )}
                  </p>
                  {user.entitlement.current_period_end && (
                    <p className="mt-0.5 text-[11px] text-muted/70">
                      {isExpired(user.entitlement)
                        ? `Expired: ${new Date(user.entitlement.current_period_end).toLocaleDateString("id-ID")}`
                        : `Aktif s/d: ${new Date(user.entitlement.current_period_end).toLocaleDateString("id-ID")}`}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {(["free", "premium", "pro"] as const).map((tier) => {
                    const effective = effectivePlan(user.entitlement);
                    const active = effective === tier;
                    const colors: Record<string, string> = {
                      free:    active ? "bg-outline text-ink ring-1 ring-primary" : "bg-surface-container text-muted",
                      premium: active ? "bg-primary text-white ring-1 ring-primary" : "bg-surface-container text-muted",
                      pro:     active ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white ring-1 ring-amber-400" : "bg-surface-container text-muted",
                    };
                    return (
                      <button
                        key={tier}
                        className={`min-h-9 rounded-lg px-3 text-xs font-bold capitalize transition active:scale-[0.98] ${colors[tier]}`}
                        onClick={() => updatePlan(user.id, tier)}
                        type="button"
                      >
                        {tier.charAt(0).toUpperCase() + tier.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </li>
          ))}
          {users.length === 0 ? <li className="text-sm text-muted">Belum ada user.</li> : null}
        </ul>
      </section>

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
