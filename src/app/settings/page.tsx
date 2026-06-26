"use client";

import {
  Bell,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  LogOut,
  Monitor,
  Moon,
  Pencil,
  Save,
  ShieldCheck,
  Sun,
  Wallet2
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { AppFrame } from "@/components/app-frame";
import { MerchantManager } from "@/components/merchant-manager";
import { PushNotificationManager } from "@/components/push-notification-manager";

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

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [salaryDay, setSalaryDay] = useState("25");
  const [budgetingPeriodMode, setBudgetingPeriodMode] = useState<BudgetingPeriodMode>("calendar_month");
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
          setSalaryDay(String(json.profile?.salary_day ?? 25));
          setBudgetingPeriodMode(
            json.profile?.budgeting_period_mode === "salary_cycle" ? "salary_cycle" : "calendar_month"
          );
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
          default_currency: "IDR",
          salary_day: Math.min(28, Math.max(1, Number.parseInt(salaryDay, 10) || 25)),
          budgeting_period_mode: budgetingPeriodMode
        })
      });
      setStatus(response.ok ? "Profile & periode budgeting tersimpan." : "Gagal menyimpan profile.");
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

          <div className="relative mt-5 space-y-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">Nama tampilan</span>
              <input
                className="mt-1 min-h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder:text-white/40 focus:border-white/40 focus:bg-white/15 focus:outline-none"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Nama kamu"
              />
            </label>

            {/* ── Budget Period Mode ── */}
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/70">
                Periode penghitungan budget
              </p>
              <div className="grid grid-cols-2 gap-2">
                {/* Option A: Bulan Kalender */}
                <button
                  type="button"
                  onClick={() => setBudgetingPeriodMode("calendar_month")}
                  className={`relative flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition active:scale-[0.97] ${
                    budgetingPeriodMode === "calendar_month"
                      ? "border-white bg-white/20 shadow-md"
                      : "border-white/20 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {budgetingPeriodMode === "calendar_month" && (
                    <CheckCircle2 size={14} className="absolute right-2 top-2 text-white" />
                  )}
                  <div className="flex size-9 items-center justify-center rounded-xl bg-white/15">
                    <CalendarDays size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">Bulan Kalender</p>
                    <p className="mt-0.5 text-[11px] text-white/70 leading-snug">
                      1 Jan – 31 Jan,<br />1 Feb – 28 Feb, dst.
                    </p>
                  </div>
                </button>

                {/* Option B: Siklus Gajian */}
                <button
                  type="button"
                  onClick={() => setBudgetingPeriodMode("salary_cycle")}
                  className={`relative flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition active:scale-[0.97] ${
                    budgetingPeriodMode === "salary_cycle"
                      ? "border-white bg-white/20 shadow-md"
                      : "border-white/20 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {budgetingPeriodMode === "salary_cycle" && (
                    <CheckCircle2 size={14} className="absolute right-2 top-2 text-white" />
                  )}
                  <div className="flex size-9 items-center justify-center rounded-xl bg-white/15">
                    <Wallet2 size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">Siklus Gajian</p>
                    <p className="mt-0.5 text-[11px] text-white/70 leading-snug">
                      Dari tgl gajian<br />ke tgl gajian berikutnya
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* ── Salary Day picker — only visible in salary_cycle mode ── */}
            {budgetingPeriodMode === "salary_cycle" && (
              <div className="rounded-2xl border border-white/20 bg-white/5 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <CalendarRange size={15} className="text-white/80" />
                  <p className="text-xs font-bold text-white">
                    Tanggal berapa kamu biasanya gajian?
                  </p>
                </div>
                <p className="mb-3 text-[11px] text-white/60">
                  Pilih tanggal di bawah. Periode budget akan dimulai dari tanggal ini setiap bulan.
                </p>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => {
                    const selected = String(day) === salaryDay;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSalaryDay(String(day))}
                        className={`flex h-9 w-full items-center justify-center rounded-xl text-sm font-bold transition active:scale-90 ${
                          selected
                            ? "bg-white text-primary shadow"
                            : "bg-white/10 text-white/80 hover:bg-white/20"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-white/60 text-center">
                  Dipilih: <span className="font-bold text-white">Tanggal {salaryDay}</span>
                </p>
              </div>
            )}

            <p className="text-xs text-white/75">
              Pengaturan ini menentukan kapan periode budget dan analisa keuangan kamu dihitung ulang setiap bulan.
            </p>
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

        {/* NOTIFICATIONS */}
        <section className="overflow-hidden rounded-2xl bg-surface shadow-card">
          <div className="flex items-center gap-3 p-4 pb-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-surface-container text-primary">
              <Bell size={18} />
            </div>
            <div>
              <p className="font-bold text-ink">Notifikasi</p>
              <p className="text-sm text-muted">Reminder &amp; alert tagihan</p>
            </div>
          </div>
          <div className="px-4 pb-4">
            <PushNotificationManager />
          </div>
        </section>

        {status ? (
          <p className="rounded-xl bg-surface-container px-4 py-3 text-sm font-bold text-primary">{status}</p>
        ) : null}

        {/* TAMPILAN — theme toggle */}
        <ThemeSection />

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

function ThemeSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const options = [
    { value: "light", label: "Terang", icon: <Sun size={18} /> },
    { value: "dark", label: "Gelap", icon: <Moon size={18} /> },
    { value: "system", label: "Sistem", icon: <Monitor size={18} /> },
  ] as const;

  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-card">
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-surface-container text-primary">
          <Moon size={18} />
        </div>
        <div>
          <p className="font-bold text-ink">Tampilan</p>
          <p className="text-sm text-muted">Mode terang / gelap</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 pb-4">
        {options.map((opt) => {
          const active = mounted && theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border py-3 text-sm font-bold transition active:scale-95 ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-outline bg-surface-container text-muted hover:border-primary/40"
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
