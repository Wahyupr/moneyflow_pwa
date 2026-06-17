"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, Info, Lock, RefreshCw, Sparkles, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Severity = "good" | "info" | "warning" | "critical";

type InsightPayload = {
  headline: string;
  severity: Severity;
  bullets: string[];
  sharing_note: string | null;
  budget_alerts: Array<{ name: string; used_pct: number }>;
  ai_error?: string | null;
};

type PlanTier = "free" | "premium";

type Status =
  | { kind: "loading" }
  | { kind: "ready"; payload: InsightPayload; generatedAt: string; plan: PlanTier; canRegenerate: boolean }
  | { kind: "empty"; plan: PlanTier }
  | { kind: "locked"; plan: PlanTier; usageCount: number; freeLimit: number }
  | { kind: "generating" }
  | { kind: "error"; message: string };

const SEVERITY_STYLE: Record<
  Severity,
  { wrap: string; icon: typeof Info; iconColor: string }
> = {
  good: { wrap: "bg-income/10 text-income", icon: CheckCircle2, iconColor: "text-income" },
  info: { wrap: "bg-primary/10 text-primary", icon: Info, iconColor: "text-primary" },
  warning: { wrap: "bg-amber-100 text-amber-700", icon: AlertTriangle, iconColor: "text-amber-700" },
  critical: { wrap: "bg-expense/10 text-expense", icon: AlertTriangle, iconColor: "text-expense" }
};

const MINIMIZED_KEY = "mf:insight-minimized";

export function DailyInsightCard() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [minimized, setMinimized] = useState(true);
  const triggeringRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(MINIMIZED_KEY);
    if (stored === "0") setMinimized(false);
  }, []);

  const toggleMinimize = useCallback(() => {
    setMinimized((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(MINIMIZED_KEY, next ? "1" : "0");
      }
      return next;
    });
  }, []);

  const triggerGenerate = useCallback(async () => {
    if (triggeringRef.current) return;
    triggeringRef.current = true;
    setStatus({ kind: "generating" });

    try {
      const response = await fetch("/api/dashboard/insight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger: "manual_button" })
      });
      const json = (await response.json().catch(() => null)) as {
        exists?: boolean;
        insight?: InsightPayload;
        generated_at?: string;
        reason?: string;
        message?: string;
        plan?: PlanTier;
        usage_count?: number;
        free_limit?: number;
      } | null;

      if (!response.ok) {
        if (json?.reason === "free_limit_reached") {
          setStatus({
            kind: "locked",
            plan: json.plan ?? "free",
            usageCount: json.usage_count ?? 1,
            freeLimit: json.free_limit ?? 1
          });
        } else {
          setStatus({
            kind: "error",
            message: json?.message ?? "Gagal membuat insight. Coba lagi nanti."
          });
        }
        return;
      }

      if (json?.exists && json.insight) {
        setStatus({
          kind: "ready",
          payload: json.insight,
          generatedAt: json.generated_at ?? new Date().toISOString(),
          plan: json.plan ?? "free",
          canRegenerate: json.plan === "premium"
        });
      } else {
        setStatus({
          kind: "error",
          message: json?.message ?? "Insight belum tersedia."
        });
      }
    } catch {
      setStatus({ kind: "error", message: "Jaringan bermasalah. Coba lagi." });
    } finally {
      triggeringRef.current = false;
    }
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetch("/api/dashboard/insight");
        const json = (await response.json().catch(() => null)) as {
          exists?: boolean;
          insight?: InsightPayload;
          generated_at?: string;
          plan?: PlanTier;
          usage_count?: number;
          free_limit?: number;
          free_limit_reached?: boolean;
          can_regenerate?: boolean;
        } | null;

        if (!active) return;

        if (json?.exists && json.insight) {
          setStatus({
            kind: "ready",
            payload: json.insight,
            generatedAt: json.generated_at ?? new Date().toISOString(),
            plan: json.plan ?? "free",
            canRegenerate: json.can_regenerate ?? false
          });
          return;
        }

        setStatus({ kind: "empty", plan: json?.plan ?? "free" });
      } catch {
        if (active) {
          setStatus({ kind: "error", message: "Tidak bisa memuat insight." });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (status.kind === "loading") {
    return <InsightSkeleton />;
  }

  const shell = { minimized, onToggleMinimize: toggleMinimize };

  if (status.kind === "empty") {
    return (
      <CardShell sealed={false} {...shell}>
        {!minimized ? (
          <>
            <div className="mt-3 rounded-lg bg-surface-container px-3 py-3">
              <p className="text-sm text-ink">
                {status.plan === "premium"
                  ? "Buat insight pertama Anda hari ini."
                  : "Buat insight pertama Anda — gratis, sekali seumur hidup."}
              </p>
            </div>
            <GenerateButton
              label="Generate Insight"
              loading={false}
              onClick={() => void triggerGenerate()}
            />
          </>
        ) : null}
      </CardShell>
    );
  }

  if (status.kind === "locked") {
    return (
      <CardShell sealed={false} {...shell}>
        {!minimized ? (
          <>
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-3">
              <p className="text-sm font-semibold text-ink">Kuota insight gratis sudah terpakai.</p>
              <p className="mt-1 text-xs text-muted">
                Upgrade ke Premium untuk insight tanpa batas, kapan pun Anda butuh.
              </p>
            </div>
            <UpgradeButton />
          </>
        ) : null}
      </CardShell>
    );
  }

  if (status.kind === "generating") {
    return (
      <CardShell sealed={false} {...shell}>
        {!minimized ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-surface-container px-3 py-3">
            <RefreshCw aria-hidden="true" className="animate-spin text-primary" size={18} />
            <p className="text-sm text-ink">Menyiapkan insight Anda...</p>
          </div>
        ) : null}
      </CardShell>
    );
  }

  if (status.kind === "error") {
    return (
      <CardShell sealed={false} {...shell}>
        {!minimized ? (
          <>
            <div className="mt-3 rounded-lg bg-expense/10 px-3 py-3">
              <p className="text-sm text-ink">{status.message}</p>
            </div>
            <GenerateButton
              label="Coba Lagi"
              loading={false}
              onClick={() => void triggerGenerate()}
            />
          </>
        ) : null}
      </CardShell>
    );
  }

  return (
    <CardShell sealed generatedAt={status.generatedAt} {...shell}>
      <ReadyInsightBody
        payload={status.payload}
        plan={status.plan}
        canRegenerate={status.canRegenerate}
        onRegenerate={() => void triggerGenerate()}
        minimized={minimized}
      />
    </CardShell>
  );
}

function CardShell({
  sealed,
  generatedAt,
  minimized,
  onToggleMinimize,
  children
}: {
  sealed: boolean;
  generatedAt?: string;
  minimized: boolean;
  onToggleMinimize: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mt-4 rounded-xl bg-surface p-4 shadow-card">
      <Header
        sealed={sealed}
        generatedAt={generatedAt}
        minimized={minimized}
        onToggleMinimize={onToggleMinimize}
      />
      {children}
    </section>
  );
}

function ReadyInsightBody({
  payload,
  plan,
  canRegenerate,
  onRegenerate,
  minimized
}: {
  payload: InsightPayload;
  plan: PlanTier;
  canRegenerate: boolean;
  onRegenerate: () => void;
  minimized: boolean;
}) {
  const style = SEVERITY_STYLE[payload.severity] ?? SEVERITY_STYLE.info;
  const Icon = style.icon;

  return (
    <>
      <div className={`mt-3 flex items-start gap-3 rounded-lg ${style.wrap} px-3 py-3`}>
        <Icon aria-hidden="true" className={style.iconColor} size={18} />
        <p className="text-sm font-semibold leading-snug text-ink">{payload.headline}</p>
      </div>

      {minimized ? null : (
        <>
          {payload.bullets.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {payload.bullets.map((bullet, idx) => (
                <li className="flex gap-2 text-sm text-ink" key={idx}>
                  <span aria-hidden="true" className="mt-1 inline-block size-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="leading-snug">{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {payload.sharing_note ? (
            <div className="mt-3 rounded-lg bg-primary/5 px-3 py-2">
              <p className="text-xs font-semibold text-primary">Dompet Bersama</p>
              <p className="mt-0.5 text-sm text-ink">{payload.sharing_note}</p>
            </div>
          ) : null}

          {payload.budget_alerts.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {payload.budget_alerts.map((alert, idx) => (
                <div
                  className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-1.5 text-xs"
                  key={idx}
                >
                  <span className="font-medium text-ink">{alert.name}</span>
                  <span
                    className={
                      alert.used_pct >= 100
                        ? "font-bold text-expense"
                        : "font-bold text-amber-700"
                    }
                  >
                    {alert.used_pct}%
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {payload.ai_error ? (
            <p className="mt-3 text-[11px] text-muted">
              Insight cadangan ditampilkan karena AI sedang tidak tersedia.
            </p>
          ) : null}

          {canRegenerate ? (
            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary active:scale-[0.98]"
              onClick={onRegenerate}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={14} />
              Generate Ulang
            </button>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2">
              <Lock aria-hidden="true" className="text-muted" size={13} />
              <p className="text-xs text-muted">
                {plan === "premium"
                  ? "Insight harian sudah ter-generate."
                  : "Insight gratis sudah digunakan. Upgrade Premium untuk insight baru."}
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}

function Header({
  sealed,
  generatedAt,
  minimized,
  onToggleMinimize
}: {
  sealed: boolean;
  generatedAt?: string;
  minimized: boolean;
  onToggleMinimize: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden="true" className="text-primary" size={16} />
        <h3 className="text-sm font-bold text-ink">Insight Hari Ini</h3>
      </div>
      <div className="flex items-center gap-1.5">
        {sealed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
            <Lock aria-hidden="true" size={11} />
            Sealed
          </span>
        ) : null}
        {generatedAt ? null : null}
        <button
          type="button"
          onClick={onToggleMinimize}
          aria-label={minimized ? "Buka insight" : "Perkecil insight"}
          aria-expanded={!minimized}
          className="flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-surface-container hover:text-ink active:scale-95"
        >
          <ChevronDown
            aria-hidden="true"
            size={16}
            className={`transition-transform duration-200 ${minimized ? "" : "rotate-180"}`}
          />
        </button>
      </div>
    </div>
  );
}

function GenerateButton({
  label,
  loading,
  onClick
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-50"
      disabled={loading}
      onClick={onClick}
      type="button"
    >
      <Zap aria-hidden="true" size={15} />
      {label}
    </button>
  );
}

function UpgradeButton() {
  return (
    <a
      href="/settings/subscription"
      className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 text-sm font-bold text-white active:scale-[0.98]"
    >
      <Sparkles aria-hidden="true" size={15} />
      Upgrade ke Premium
    </a>
  );
}

function InsightSkeleton() {
  return (
    <section className="mt-4 rounded-xl bg-surface p-4 shadow-card" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 animate-pulse rounded bg-surface-container" />
        <div className="h-4 w-16 animate-pulse rounded bg-surface-container" />
      </div>
      <div className="mt-3 h-12 animate-pulse rounded-lg bg-surface-container" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-surface-container" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-surface-container" />
      </div>
    </section>
  );
}
