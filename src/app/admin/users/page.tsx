"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, UserRound } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { Toast, useToast } from "@/components/ui/toast";

type Plan = "free" | "premium" | "pro";

type AdminUser = {
  id: string;
  display_name: string | null;
  role: "user" | "admin" | "cs";
  default_currency: string;
  created_at: string;
  entitlement: { plan: Plan; status: string; current_period_end: string | null };
  credits: { allowance: number | null; used: number; remaining: number | null };
};

function isExpired(e: AdminUser["entitlement"]): boolean {
  return e.current_period_end !== null && new Date(e.current_period_end) <= new Date();
}

function effectivePlan(e: AdminUser["entitlement"]): Plan {
  return isExpired(e) ? "free" : e.plan;
}

const PLAN_BADGE: Record<Plan, string> = {
  free: "bg-outline/60 text-ink",
  premium: "bg-primary text-white",
  pro: "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
};

export default function AdminUsersPage() {
  return (
    <AppFrame title="User & Subscription" subtitle="Kelola plan & pantau kredit">
      <UsersContent />
    </AppFrame>
  );
}

function UsersContent() {
  const { toast, showToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    if (res.ok) setUsers((await res.json()).users ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updatePlan(userId: string, plan: Plan) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId, plan })
    });
    if (res.ok) {
      showToast("Subscription diperbarui.", "success");
      void load();
    } else {
      showToast("Gagal memperbarui subscription.", "error");
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (u) => (u.display_name ?? "").toLowerCase().includes(needle) || u.id.toLowerCase().includes(needle)
    );
  }, [q, users]);

  if (forbidden) {
    return (
      <div className="mt-6 rounded-2xl bg-surface p-6 text-center shadow-card">
        <p className="font-bold text-ink">Akses ditolak</p>
        <p className="mt-2 text-sm text-muted">Halaman ini hanya untuk admin.</p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <Toast toast={toast} />

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama atau ID user…"
          className="w-full rounded-xl border border-outline bg-surface py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <p className="text-xs text-muted">{filtered.length} user</p>

      <ul className="space-y-2">
        {filtered.map((user) => (
          <UserRow key={user.id} user={user} onUpdatePlan={updatePlan} />
        ))}
        {filtered.length === 0 && <li className="text-sm text-muted">Tidak ada user.</li>}
      </ul>
    </div>
  );
}

function UserRow({ user, onUpdatePlan }: { user: AdminUser; onUpdatePlan: (id: string, plan: Plan) => void }) {
  const effective = effectivePlan(user.entitlement);
  const expired = isExpired(user.entitlement);
  const { allowance, used, remaining } = user.credits;
  const pct = allowance && allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0;

  return (
    <li className="rounded-2xl border border-outline bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
            <UserRound size={16} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{user.display_name ?? "Tanpa nama"}</p>
            <p className="text-xs text-muted">
              {user.role} · {user.entitlement.status}
              {expired && (
                <span className="ml-1.5 rounded bg-expense/15 px-1.5 py-0.5 text-[10px] font-bold text-expense">
                  expired → free
                </span>
              )}
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${PLAN_BADGE[effective]}`}>
          {effective}
        </span>
      </div>

      {/* Credit meter */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>Kredit AI (30 hari)</span>
          <span className="font-semibold text-ink">
            {allowance === null ? `${used} terpakai · ∞` : `${used} / ${allowance} (sisa ${remaining})`}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-outline/40">
          <div
            className={`h-full rounded-full ${pct >= 90 ? "bg-expense" : pct >= 60 ? "bg-amber-500" : "bg-income"}`}
            style={{ width: `${allowance === null ? 8 : pct}%` }}
          />
        </div>
      </div>

      {/* Plan switcher */}
      <div className="mt-3 flex gap-1.5">
        {(["free", "premium", "pro"] as const).map((tier) => {
          const active = effective === tier;
          return (
            <button
              key={tier}
              type="button"
              onClick={() => onUpdatePlan(user.id, tier)}
              className={`min-h-9 flex-1 rounded-lg px-3 text-xs font-bold capitalize transition active:scale-[0.98] ${
                active ? PLAN_BADGE[tier] + " ring-1 ring-primary" : "bg-surface-container text-muted hover:bg-outline/30"
              }`}
            >
              {tier}
            </button>
          );
        })}
      </div>
    </li>
  );
}
