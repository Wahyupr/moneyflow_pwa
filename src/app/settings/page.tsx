"use client";

import {
  Bell,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Crown,
  LogOut,
  Monitor,
  Moon,
  Receipt,
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  Wallet2,
  Zap,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { PRICES, formatRp } from "@/components/landing/pricing";
import { AppFrame } from "@/components/app-frame";
import { MerchantManager } from "@/components/merchant-manager";
import { PushNotificationManager } from "@/components/push-notification-manager";

// ─── Types ────────────────────────────────────────────────────────────────────

type BudgetingPeriodMode = "salary_cycle" | "calendar_month";

type ProfilePayload = {
  user?: { email?: string | null };
  profile?: {
    display_name?: string | null;
    role?: "user" | "admin" | null;
    salary_day?: number | null;
    budgeting_period_mode?: BudgetingPeriodMode | null;
  };
};

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-lift">
      <CheckCircle2 size={16} className="shrink-0 text-income" />
      {message}
      <button onClick={onDismiss} className="ml-1 text-white/60 hover:text-white">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [salaryDay, setSalaryDay] = useState("25");
  const [savedSalaryDay, setSavedSalaryDay] = useState("25");
  const [budgetingPeriodMode, setBudgetingPeriodMode] = useState<BudgetingPeriodMode>("calendar_month");
  const [savedBudgetMode, setSavedBudgetMode] = useState<BudgetingPeriodMode>("calendar_month");
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const isDirty =
    displayName !== savedName ||
    salaryDay !== savedSalaryDay ||
    budgetingPeriodMode !== savedBudgetMode;

  useEffect(() => {
    let active = true;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: ProfilePayload | null) => {
        if (json && active) {
          const name = json.profile?.display_name ?? "";
          const day = String(json.profile?.salary_day ?? 25);
          const mode: BudgetingPeriodMode =
            json.profile?.budgeting_period_mode === "salary_cycle" ? "salary_cycle" : "calendar_month";
          setDisplayName(name);
          setSavedName(name);
          setEmail(json.user?.email ?? "");
          setRole(json.profile?.role === "admin" ? "admin" : "user");
          setSalaryDay(day);
          setSavedSalaryDay(day);
          setBudgetingPeriodMode(mode);
          setSavedBudgetMode(mode);
        }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          locale: "id-ID",
          default_currency: "IDR",
          salary_day: Math.min(28, Math.max(1, parseInt(salaryDay, 10) || 25)),
          budgeting_period_mode: budgetingPeriodMode,
        }),
      });
      if (res.ok) {
        setSavedName(displayName);
        setSavedSalaryDay(salaryDay);
        setSavedBudgetMode(budgetingPeriodMode);
        setToast("Perubahan tersimpan.");
      } else {
        setToast("Gagal menyimpan — coba lagi.");
      }
    } finally {
      setSavingProfile(false);
    }
  }

  const initials = (displayName.trim() || email.trim() || "?")
    .split(/\s+/)
    .map((p) => p.slice(0, 1).toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <AppFrame title="Settings" subtitle="Pengaturan">
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      <div className="mt-4 space-y-6 pb-8" suppressHydrationWarning>

        {/* ── Profile hero card ──────────────────────────── */}
        <div className="overflow-hidden rounded-3xl bg-surface shadow-card">
          {/* Gradient accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-primary to-tertiary" />
          <div className="flex items-center gap-4 p-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-xl font-black text-primary">
                {loading ? "…" : initials}
              </div>
              {role === "admin" && (
                <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary shadow-card">
                  <ShieldCheck size={11} className="text-white" />
                </span>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-ink">
                {loading ? "Memuat…" : displayName.trim() || "Tanpa Nama"}
              </p>
              <p className="truncate text-sm text-muted">{email || "—"}</p>
            </div>
          </div>
        </div>

        {/* ── Akun ───────────────────────────────────────── */}
        <SettingsGroup label="Akun">
          <SettingsCard>
            <label className="block px-4 pt-4">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
                <UserRound size={12} />
                Nama tampilan
              </span>
              <input
                className="mt-2 w-full bg-transparent pb-3 text-base font-semibold text-ink placeholder:text-muted/50 focus:outline-none"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nama kamu"
              />
            </label>
            <div className="h-px bg-outline/60 mx-4" />
            <div className="px-4 py-3">
              <p className="text-xs text-muted">Email</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{email || "—"}</p>
            </div>
          </SettingsCard>
        </SettingsGroup>

        {/* ── Budget Period ───────────────────────────────── */}
        <SettingsGroup label="Periode Anggaran">
          <SettingsCard>
            {/* Segmented mode toggle */}
            <div className="p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">
                Mode perhitungan
              </p>
              <div className="flex rounded-2xl bg-surface-low p-1">
                {(
                  [
                    { value: "calendar_month", label: "Kalender", icon: <CalendarDays size={14} /> },
                    { value: "salary_cycle", label: "Gajian", icon: <Wallet2 size={14} /> },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBudgetingPeriodMode(opt.value)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${
                      budgetingPeriodMode === opt.value
                        ? "bg-surface text-primary shadow-card"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>

              {budgetingPeriodMode === "calendar_month" && (
                <p className="mt-3 text-sm text-muted">
                  Budget dihitung dari tanggal 1 hingga akhir bulan.
                </p>
              )}
            </div>

            {/* Salary day picker — only when salary_cycle */}
            {budgetingPeriodMode === "salary_cycle" && (
              <>
                <div className="h-px bg-outline/60 mx-4" />
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarRange size={14} className="text-primary" />
                    <p className="text-xs font-bold uppercase tracking-widest text-muted">
                      Tanggal gajian
                    </p>
                    <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                      Tgl {salaryDay}
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => {
                      const sel = String(day) === salaryDay;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setSalaryDay(String(day))}
                          className={`flex h-9 w-full items-center justify-center rounded-xl text-sm font-semibold transition active:scale-95 ${
                            sel
                              ? "bg-primary text-white shadow-sm"
                              : "text-muted hover:bg-surface-low hover:text-ink"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </SettingsCard>
        </SettingsGroup>

        {/* Save button — only visible when dirty */}
        {isDirty && (
          <button
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-white shadow-card transition active:scale-[0.98] disabled:opacity-60"
            onClick={saveProfile}
            type="button"
            disabled={savingProfile}
          >
            <Save size={18} />
            {savingProfile ? "Menyimpan…" : "Simpan Perubahan"}
          </button>
        )}

        {/* ── Tampilan ─────────────────────────────────────── */}
        <ThemeGroup />

        {/* ── Notifikasi ───────────────────────────────────── */}
        <SettingsGroup label="Notifikasi">
          <SettingsCard>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Bell size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">Push notification</p>
                <p className="text-sm text-muted">Pengingat tagihan & update penting</p>
              </div>
            </div>
            <div className="h-px bg-outline/60 mx-4" />
            <div className="px-4 py-3">
              <PushNotificationManager />
            </div>
          </SettingsCard>
        </SettingsGroup>

        {/* ── Plan & Usage ──────────────────────────────────── */}
        <PlanUsageSection />

        {/* ── Admin ─────────────────────────────────────────── */}
        {role === "admin" && (
          <SettingsGroup label="Admin">
            <SettingsCard>
              <Link
                href="/admin"
                className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-low active:scale-[0.99]"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ShieldCheck size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">Panel Admin</p>
                  <p className="text-sm text-muted">Merchant, kategori, dan user</p>
                </div>
                <ChevronRight size={16} className="text-muted" />
              </Link>
              <div className="h-px bg-outline/60 mx-4" />
              <div className="px-4 py-3">
                <MerchantManager onStatus={(msg) => setToast(msg)} />
              </div>
            </SettingsCard>
          </SettingsGroup>
        )}

        {/* ── Keluar ─────────────────────────────────────────── */}
        <SettingsGroup label="Akses">
          <button
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-expense/30 bg-expense/8 font-bold text-expense transition hover:bg-expense/15 active:scale-[0.98]"
            onClick={() => {
              fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                window.location.href = "/login";
              });
            }}
            type="button"
          >
            <LogOut size={18} />
            Keluar dari akun
          </button>
        </SettingsGroup>

      </div>
    </AppFrame>
  );
}

// ─── Theme segmented control ─────────────────────────────────────────────────

function ThemeGroup() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const options = [
    { value: "light", label: "Terang", icon: <Sun size={16} /> },
    { value: "dark",  label: "Gelap",  icon: <Moon size={16} /> },
    { value: "system",label: "Sistem", icon: <Monitor size={16} /> },
  ] as const;

  return (
    <SettingsGroup label="Tampilan">
      <SettingsCard>
        <div className="p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">Tema</p>
          <div className="flex rounded-2xl bg-surface-low p-1">
            {options.map((opt) => {
              const active = mounted && theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${
                    active
                      ? "bg-surface text-primary shadow-card"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </SettingsCard>
    </SettingsGroup>
  );
}

// ─── Plan & Usage ─────────────────────────────────────────────────────────────

type UsageItem = { key: string; label: string; used: number; max: number | null };
type UsagePayload = { plan: string; items: UsageItem[] };

const PLAN_META: Record<string, {
  label: string;
  icon: React.ReactNode;
  gradient: string;
  text: string;
}> = {
  free:    { label: "Free",    icon: <Sparkles size={14} />, gradient: "from-slate-400 to-slate-500",  text: "text-slate-100" },
  premium: { label: "Premium", icon: <Crown size={14} />,    gradient: "from-primary to-tertiary",      text: "text-white" },
  pro:     { label: "Pro",     icon: <Zap size={14} />,      gradient: "from-amber-500 to-orange-500",  text: "text-white" },
};

function PlanUsageSection() {
  const [data, setData] = useState<UsagePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/profile/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: UsagePayload | null) => { if (active && json) setData(json); })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const plan = data?.plan ?? "free";
  const meta = PLAN_META[plan] ?? PLAN_META.free;
  const cappedItems = (data?.items ?? []).filter((i) => i.max !== null);

  return (
    <SettingsGroup label="Paket & Penggunaan">
      <SettingsCard>
        {/* Plan banner */}
        <div className={`mx-4 mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-r ${meta.gradient} px-4 py-3.5`}>
          <div className={`flex items-center gap-2 ${meta.text}`}>
            {meta.icon}
            <span className="font-bold">Paket {meta.label}</span>
          </div>
          {plan === "free" && (
            <Link
              href="/pricing"
              className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95"
            >
              Upgrade →
            </Link>
          )}
        </div>

        {/* Quota bars */}
        <div className="px-4 pb-4 pt-3">
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-low" />
              ))}
            </div>
          ) : cappedItems.length === 0 ? (
            <p className="rounded-xl bg-surface-low px-4 py-3 text-sm text-muted">
              🎉 Semua fitur tidak terbatas di paket {meta.label}.
            </p>
          ) : (
            <ul className="space-y-2">
              {cappedItems.map((item) => {
                const max = item.max as number;
                const pct = Math.min(100, Math.round((item.used / max) * 100));
                const nearLimit = pct >= 80;
                const atLimit = item.used >= max;
                return (
                  <li key={item.key} className="rounded-xl bg-surface-low px-3.5 py-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-ink">{item.label}</span>
                      <span className={`font-bold tabular-nums text-xs ${atLimit ? "text-expense" : nearLimit ? "text-amber-500" : "text-muted"}`}>
                        {item.used}/{max}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-outline">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          atLimit ? "bg-expense" : nearLimit ? "bg-amber-500" : "bg-primary"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Upgrade CTA — Premium → Pro */}
        {plan === "premium" && (
          <>
            <div className="h-px bg-outline/60 mx-4" />
            <div className="p-4">
              <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 p-4 dark:from-amber-950/30 dark:to-orange-950/30">
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                    <Zap size={15} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">Upgrade ke Pro</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted">
                      Bayar selisih{" "}
                      <span className="font-bold text-amber-600">
                        {formatRp(PRICES.pro.monthly - PRICES.premium.monthly)}/bln
                      </span>{" "}
                      (atau{" "}
                      <span className="font-bold text-amber-600">
                        {formatRp(PRICES.pro.yearly_per_month - PRICES.premium.yearly_per_month)}/bln
                      </span>{" "}
                      tahunan).
                    </p>
                  </div>
                </div>
                <Link
                  href="/pricing"
                  className="mt-3 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-sm font-bold text-white shadow-card transition hover:brightness-110 active:scale-[0.98]"
                >
                  <Zap size={13} />
                  Upgrade ke Pro
                </Link>
              </div>
            </div>
          </>
        )}

        {/* CTA for free users */}
        {plan === "free" && (
          <>
            <div className="h-px bg-outline/60 mx-4" />
            <div className="p-4">
              <Link
                href="/pricing"
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 font-bold text-primary transition hover:bg-primary/5 active:scale-[0.98]"
              >
                <Crown size={15} />
                Lihat paket Premium & Pro
              </Link>
            </div>
          </>
        )}

        {/* Riwayat pembayaran — always visible */}
        <div className="h-px bg-outline/60 mx-4" />
        <Link
          href="/payments/history"
          className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-low active:scale-[0.99]"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Receipt size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Riwayat Pembayaran</p>
            <p className="text-sm text-muted">Transaksi langganan Premium & Pro</p>
          </div>
          <ChevronRight size={16} className="text-muted" />
        </Link>
      </SettingsCard>
    </SettingsGroup>
  );
}

// ─── Layout primitives ────────────────────────────────────────────────────────

function SettingsGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-card">
      {children}
    </div>
  );
}
