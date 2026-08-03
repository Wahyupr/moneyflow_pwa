"use client";

import { useCallback, useEffect, useState } from "react";
import { Infinity as InfinityIcon, Sparkles, SlidersHorizontal } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { Toast, useToast } from "@/components/ui/toast";

type Plan = "free" | "premium" | "pro";

type PlanRow = {
  plan: Plan;
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
  ai_credits_per_cycle: number | null;
  ai_chat: boolean;
  updated_at: string;
};

type CostRow = { action: "voice" | "scan" | "insight" | "chat"; credits: number; label: string };

const LIMIT_FIELDS: Array<{ key: keyof Omit<PlanRow, "plan" | "ai_chat" | "updated_at">; label: string; unit?: string }> = [
  { key: "ai_credits_per_cycle", label: "Kredit AI / siklus", unit: "kredit" },
  { key: "wallets", label: "Dompet", unit: "dompet" },
  { key: "active_budgets", label: "Budget aktif", unit: "budget" },
  { key: "history_months", label: "Riwayat", unit: "bulan" },
  { key: "voice_per_day", label: "Voice / hari", unit: "kali" },
  { key: "scan_per_day", label: "Scan / hari", unit: "kali" },
  { key: "export_per_month", label: "Ekspor / bulan", unit: "kali" },
  { key: "ai_insights_per_month", label: "AI Insight / bulan", unit: "kali" },
  { key: "debt_records", label: "Hutang & Piutang", unit: "catatan" },
  { key: "shared_wallets", label: "Dompet bersama", unit: "dompet" },
  { key: "reminders", label: "Pengingat", unit: "item" },
  { key: "custom_merchants", label: "Merchant kustom", unit: "item" },
  { key: "custom_categories", label: "Kategori kustom", unit: "item" }
];

const PLAN_BADGE: Record<Plan, string> = {
  free: "bg-outline/60 text-ink",
  premium: "bg-primary text-white",
  pro: "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
};


export default function AdminPlansPage() {
  return (
    <AppFrame title="Paket & Kredit AI" subtitle="Atur limit fitur dan kredit AI">
      <PlansContent />
    </AppFrame>
  );
}

function PlansContent() {
  const { toast, showToast } = useToast();
  const [limits, setLimits] = useState<PlanRow[]>([]);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [costDraft, setCostDraft] = useState<Record<string, string>>({});
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    const [limitsRes, costsRes] = await Promise.all([
      fetch("/api/admin/plan-limits"),
      fetch("/api/admin/ai-credit-costs")
    ]);
    if (limitsRes.status === 403) {
      setForbidden(true);
      return;
    }
    if (limitsRes.ok) setLimits((await limitsRes.json()).limits ?? []);
    if (costsRes.ok) {
      const rows: CostRow[] = (await costsRes.json()).costs ?? [];
      setCosts(rows);
      setCostDraft(Object.fromEntries(rows.map((r) => [r.action, String(r.credits)])));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(plan: Plan) {
    const row = limits.find((l) => l.plan === plan);
    if (!row) return;
    const vals: Record<string, string> = { ai_chat: String(row.ai_chat) };
    for (const { key } of LIMIT_FIELDS) vals[key] = row[key] === null ? "" : String(row[key]);
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
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast(`Limit paket ${editingPlan} disimpan.`, "success");
      setEditingPlan(null);
      void load();
    } else {
      showToast("Gagal menyimpan limit.", "error");
    }
  }

  async function saveCost(action: string) {
    const credits = Number(costDraft[action] ?? 0);
    const res = await fetch("/api/admin/ai-credit-costs", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, credits })
    });
    if (res.ok) {
      showToast("Bobot kredit disimpan.", "success");
      void load();
    } else {
      showToast("Gagal menyimpan bobot.", "error");
    }
  }

  if (forbidden) {
    return (
      <div className="mt-6 rounded-2xl bg-surface p-6 text-center shadow-card">
        <p className="font-bold text-ink">Akses ditolak</p>
        <p className="mt-2 text-sm text-muted">Halaman ini hanya untuk admin.</p>
      </div>
    );
  }

  const costMap = Object.fromEntries(costs.map((c) => [c.action, c.credits]));

  return (
    <div className="mt-5 space-y-6">
      <Toast toast={toast} />

      <AiCreditSection
        costs={costs}
        costDraft={costDraft}
        setCostDraft={setCostDraft}
        onSave={saveCost}
        limits={limits}
        costMap={costMap}
      />

      <PlanLimitsSection
        limits={limits}
        editingPlan={editingPlan}
        editValues={editValues}
        setEditValues={setEditValues}
        onStartEdit={startEdit}
        onCancel={() => setEditingPlan(null)}
        onSave={saveLimits}
      />
    </div>
  );
}

function fmtLimit(v: number | null): string {
  return v === null ? "∞" : String(v);
}

function AiCreditSection({
  costs,
  costDraft,
  setCostDraft,
  onSave,
  limits,
  costMap
}: {
  costs: CostRow[];
  costDraft: Record<string, string>;
  setCostDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: (action: string) => void;
  limits: PlanRow[];
  costMap: Record<string, number>;
}) {
  const freeAllowance = limits.find((l) => l.plan === "free")?.ai_credits_per_cycle ?? null;
  const voiceCost = costMap.voice ?? 1;
  const scanCost = costMap.scan ?? 2;
  const insightCost = costMap.insight ?? 5;

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
          <Sparkles size={18} />
        </div>
        <div>
          <h2 className="font-bold text-ink">Bobot Kredit AI</h2>
          <p className="text-sm text-muted">Biaya kredit tiap aksi AI. Reset tiap 30 hari per user.</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {costs.map((c) => (
          <div key={c.action} className="flex items-center gap-3 rounded-xl border border-outline bg-surface-container p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{c.label}</p>
              <p className="text-[11px] uppercase tracking-wide text-muted">{c.action}</p>
            </div>
            <input
              type="number"
              min={0}
              value={costDraft[c.action] ?? ""}
              onChange={(e) => setCostDraft((prev) => ({ ...prev, [c.action]: e.target.value }))}
              className="w-20 rounded-lg border border-outline bg-surface px-2 py-1.5 text-right text-sm text-ink focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-xs text-muted">kredit</span>
            <button
              type="button"
              onClick={() => onSave(c.action)}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary/90 active:scale-95"
            >
              Simpan
            </button>
          </div>
        ))}
        {costs.length === 0 && (
          <p className="text-sm text-muted">Tabel ai_credit_costs belum dibuat. Jalankan migrasi.</p>
        )}
      </div>

      {freeAllowance !== null && (
        <div className="mt-4 rounded-xl bg-primary/5 p-3 text-sm text-ink">
          <p className="font-semibold text-primary">Simulasi paket Free ({freeAllowance} kredit/siklus)</p>
          <p className="mt-1 text-muted">
            ≈ {Math.floor(freeAllowance / voiceCost)} voice, atau {Math.floor(freeAllowance / scanCost)} scan, atau{" "}
            {Math.floor(freeAllowance / insightCost)} AI insight.
          </p>
        </div>
      )}
    </section>
  );
}

function PlanLimitsSection({
  limits,
  editingPlan,
  editValues,
  setEditValues,
  onStartEdit,
  onCancel,
  onSave
}: {
  limits: PlanRow[];
  editingPlan: Plan | null;
  editValues: Record<string, string>;
  setEditValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onStartEdit: (plan: Plan) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SlidersHorizontal size={18} />
        </div>
        <div>
          <h2 className="font-bold text-ink">Limit Fitur per Paket</h2>
          <p className="text-sm text-muted">Kosongkan untuk tak terbatas (∞).</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {(["free", "premium", "pro"] as const).map((plan) => {
          const row = limits.find((l) => l.plan === plan);
          const isEditing = editingPlan === plan;
          return (
            <div key={plan} className="rounded-xl border border-outline bg-surface-container p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${PLAN_BADGE[plan]}`}>{plan}</span>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => onStartEdit(plan)}
                    className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onCancel}
                      className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-outline/30"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={onSave}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary/90"
                    >
                      Simpan
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {LIMIT_FIELDS.map(({ key, label, unit }) => {
                  const rawVal = row ? row[key] : null;
                  const highlight = key === "ai_credits_per_cycle";
                  return (
                    <div key={key} className="flex flex-col gap-0.5">
                      <span className={`text-[11px] font-medium ${highlight ? "text-primary" : "text-muted"}`}>{label}</span>
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          placeholder="∞"
                          value={editValues[key] ?? ""}
                          onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="w-full rounded-md border border-outline bg-surface px-2 py-1 text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      ) : (
                        <span className="flex items-center gap-1 text-sm font-semibold text-ink">
                          {rawVal === null ? (
                            <InfinityIcon size={14} className="text-income" />
                          ) : (
                            <>
                              {rawVal}
                              {unit && <span className="text-[10px] font-normal text-muted">{unit}</span>}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}

                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium text-muted">AI Chat</span>
                  {isEditing ? (
                    <select
                      value={editValues.ai_chat ?? "false"}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, ai_chat: e.target.value }))}
                      className="rounded-md border border-outline bg-surface px-2 py-1 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="false">Tidak</option>
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
                  Kredit: {fmtLimit(row.ai_credits_per_cycle)} · Diubah {new Date(row.updated_at).toLocaleDateString("id-ID")}
                </p>
              )}
            </div>
          );
        })}

        {limits.length === 0 && (
          <p className="text-sm text-muted">Tabel plan_limits belum dibuat. Jalankan migrasi.</p>
        )}
      </div>
    </section>
  );
}


