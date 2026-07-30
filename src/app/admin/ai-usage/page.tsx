"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Mic, ScanLine, Lightbulb, MessageSquare, TrendingUp } from "lucide-react";
import { AppFrame } from "@/components/app-frame";

type ActionStat = { action: string; credits: number; calls: number };
type TrendPoint = { day: string; credits: number; calls: number };
type TopUser = { user_id: string; display_name: string | null; credits: number; calls: number };

type UsageData = {
  today: { credits: number; calls: number };
  month: { credits: number; calls: number };
  byAction: ActionStat[];
  trend: TrendPoint[];
  topUsers: TopUser[];
};

const ACTION_META: Record<string, { label: string; icon: typeof Mic; tint: string }> = {
  voice: { label: "Voice", icon: Mic, tint: "bg-primary/10 text-primary" },
  scan: { label: "Scan struk", icon: ScanLine, tint: "bg-violet-500/10 text-violet-600" },
  insight: { label: "AI Insight", icon: Lightbulb, tint: "bg-amber-500/10 text-amber-600" },
  chat: { label: "AI Chat", icon: MessageSquare, tint: "bg-income/10 text-income" }
};

export default function AdminAiUsagePage() {
  return (
    <AppFrame title="Pemantauan AI" subtitle="Pemakaian kredit AI">
      <UsageContent />
    </AppFrame>
  );
}

function UsageContent() {
  const [data, setData] = useState<UsageData | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/ai-usage");
    if (res.status === 403) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (forbidden) {
    return (
      <div className="mt-6 rounded-2xl bg-surface p-6 text-center shadow-card">
        <p className="font-bold text-ink">Akses ditolak</p>
        <p className="mt-2 text-sm text-muted">Halaman ini hanya untuk admin.</p>
      </div>
    );
  }

  if (loading || !data) {
    return <p className="mt-6 text-sm text-muted">Memuat data…</p>;
  }

  const maxTrend = Math.max(1, ...data.trend.map((t) => t.credits));

  return (
    <div className="mt-5 space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Kredit hari ini" value={data.today.credits} sub={`${data.today.calls} panggilan`} />
        <StatCard label="Kredit 30 hari" value={data.month.credits} sub={`${data.month.calls} panggilan`} />
      </div>

      {/* Breakdown by action */}
      <section className="rounded-2xl bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="font-bold text-ink">Breakdown per Aksi</h2>
            <p className="text-sm text-muted">30 hari terakhir</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(["voice", "scan", "insight", "chat"] as const).map((action) => {
            const stat = data.byAction.find((a) => a.action === action);
            const meta = ACTION_META[action];
            return (
              <div key={action} className="rounded-xl border border-outline bg-surface-container p-3">
                <div className={`mb-2 flex size-8 items-center justify-center rounded-lg ${meta.tint}`}>
                  <meta.icon size={16} />
                </div>
                <p className="text-sm font-semibold text-ink">{meta.label}</p>
                <p className="text-lg font-bold text-ink">{stat?.credits ?? 0}</p>
                <p className="text-[11px] text-muted">{stat?.calls ?? 0} panggilan</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Daily trend */}
      <section className="rounded-2xl bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TrendingUp size={18} />
          </div>
          <div>
            <h2 className="font-bold text-ink">Tren Harian</h2>
            <p className="text-sm text-muted">Kredit terpakai per hari (14 hari)</p>
          </div>
        </div>
        {data.trend.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Belum ada pemakaian.</p>
        ) : (
          <div className="mt-4 flex h-32 items-end gap-1">
            {data.trend.map((t) => (
              <div key={t.day} className="flex flex-1 flex-col items-center gap-1" title={`${t.day}: ${t.credits} kredit`}>
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${Math.max(4, (t.credits / maxTrend) * 100)}%` }}
                />
                <span className="text-[9px] text-muted">{t.day.slice(8)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Top users */}
      <section className="rounded-2xl bg-surface p-5 shadow-card">
        <h2 className="font-bold text-ink">Top Pengguna AI</h2>
        <p className="text-sm text-muted">30 hari terakhir</p>
        <ul className="mt-4 space-y-2">
          {data.topUsers.map((u, i) => (
            <li key={u.user_id} className="flex items-center gap-3 rounded-xl border border-outline bg-surface-container p-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{u.display_name ?? "Tanpa nama"}</p>
                <p className="text-[11px] text-muted">{u.calls} panggilan</p>
              </div>
              <span className="shrink-0 text-sm font-bold text-ink">{u.credits} kredit</span>
            </li>
          ))}
          {data.topUsers.length === 0 && <li className="text-sm text-muted">Belum ada pemakaian.</li>}
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value.toLocaleString("id-ID")}</p>
      <p className="text-[11px] text-muted">{sub}</p>
    </div>
  );
}
