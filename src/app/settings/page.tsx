"use client";

import {
  Bell,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  LogOut,
  Monitor,
  Moon,
  Save,
  ShieldCheck,
  Sun,
  UserRound,
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

  const budgetModeLabel = budgetingPeriodMode === "salary_cycle" ? `Siklus gajian • Tgl ${salaryDay}` : "Bulan kalender";

  return (
    <AppFrame title="Settings" subtitle="Pengaturan">
      <div className="mt-5 space-y-5">
        <section className="rounded-[28px] border border-surface-container bg-surface p-4 shadow-card">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-primary/10 text-lg font-black tracking-tight text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-lg font-bold text-ink">
                  {loading ? "Memuat..." : displayName.trim() || "Tanpa Nama"}
                </p>
                {role === "admin" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                    <ShieldCheck size={10} aria-hidden="true" />
                    Admin
                  </span>
                ) : null}
              </div>
              <p className="truncate text-sm text-muted">{email || "—"}</p>
              <p className="mt-1 text-xs text-muted">Kelola profil, periode budgeting, notifikasi, dan tampilan aplikasi.</p>
            </div>
          </div>
        </section>

        {status ? (
          <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">
            {status}
          </div>
        ) : null}

        <SettingsSection
          eyebrow="Akun"
          title="Informasi pengguna"
          description="Perbarui nama tampilan yang muncul di aplikasi."
        >
          <SettingRow
            icon={<UserRound size={18} />}
            title="Nama tampilan"
            description="Nama ini akan tampil di dashboard dan menu akun."
          >
            <input
              className="mt-3 min-h-12 w-full rounded-2xl border border-outline bg-background px-4 text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Nama kamu"
            />
          </SettingRow>
        </SettingsSection>

        <SettingsSection
          eyebrow="Budgeting"
          title="Periode anggaran"
          description="Atur cara MoneyFlow menghitung periode budget bulanan."
        >
          <SettingRow
            icon={<CalendarDays size={18} />}
            title="Mode perhitungan"
            description={budgetModeLabel}
          >
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <BudgetOptionCard
                active={budgetingPeriodMode === "calendar_month"}
                icon={<CalendarDays size={18} className="text-primary" />}
                title="Bulan Kalender"
                description="Periode mengikuti awal sampai akhir bulan."
                onClick={() => setBudgetingPeriodMode("calendar_month")}
              />
              <BudgetOptionCard
                active={budgetingPeriodMode === "salary_cycle"}
                icon={<Wallet2 size={18} className="text-primary" />}
                title="Siklus Gajian"
                description="Periode dimulai dari tanggal gajian ke tanggal berikutnya."
                onClick={() => setBudgetingPeriodMode("salary_cycle")}
              />
            </div>
          </SettingRow>

          {budgetingPeriodMode === "salary_cycle" ? (
            <SettingRow
              icon={<CalendarRange size={18} />}
              title="Tanggal gajian"
              description={`Saat ini dimulai tiap tanggal ${salaryDay}.`}
            >
              <div className="mt-3 rounded-2xl bg-background p-3">
                <p className="mb-3 text-xs text-muted">
                  Pilih tanggal gajian utama. Budget akan disusun mengikuti tanggal ini setiap bulan.
                </p>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => {
                    const selected = String(day) === salaryDay;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSalaryDay(String(day))}
                        className={`flex h-10 w-full items-center justify-center rounded-2xl text-sm font-bold transition active:scale-95 ${
                          selected
                            ? "bg-primary text-white shadow-card"
                            : "bg-surface text-muted hover:border-primary/40 hover:text-primary"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </SettingRow>
          ) : null}

          <button
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 font-bold text-white shadow-card transition active:scale-[0.98] disabled:opacity-60"
            onClick={saveProfile}
            type="button"
            disabled={savingProfile}
          >
            <Save size={18} />
            {savingProfile ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </SettingsSection>

        <SettingsSection
          eyebrow="Notifikasi"
          title="Reminder & alert"
          description="Kelola izin notifikasi untuk pengingat tagihan dan update penting."
        >
          <SettingRow
            icon={<Bell size={18} />}
            title="Push notification"
            description="Aktifkan agar pengingat penting muncul langsung di perangkat."
          >
            <div className="mt-3 rounded-2xl bg-background p-3">
              <PushNotificationManager />
            </div>
          </SettingRow>
        </SettingsSection>

        <ThemeSection />

        {role === "admin" ? (
          <SettingsSection
            eyebrow="Admin"
            title="Pengelolaan data"
            description="Akses cepat ke panel admin dan daftar merchant."
          >
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-2xl border border-outline bg-background px-4 py-3 transition hover:border-primary/30 hover:bg-primary/5 active:scale-[0.99]"
            >
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">Panel Admin</p>
                <p className="truncate text-sm text-muted">Kelola merchant, kategori, dan user</p>
              </div>
              <ChevronRight size={18} className="text-muted" />
            </Link>
            <div className="rounded-2xl bg-background p-3">
              <MerchantManager onStatus={setStatus} />
            </div>
          </SettingsSection>
        ) : null}

        <SettingsSection
          eyebrow="Akses"
          title="Keamanan akun"
          description="Keluar dari sesi aktif di perangkat ini."
        >
          <button
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-expense px-4 font-bold text-white shadow-card transition active:scale-[0.98] active:brightness-90"
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
        </SettingsSection>
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
    <SettingsSection
      eyebrow="Tampilan"
      title="Tema aplikasi"
      description="Pilih mode yang paling nyaman dilihat di perangkat kamu."
    >
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const active = mounted && theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition active:scale-95 ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-outline bg-background text-muted hover:border-primary/40"
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>
    </SettingsSection>
  );
}

function SettingsSection({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-surface-container bg-surface p-4 shadow-card">
      <div className="mb-4">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted">{eyebrow}</p>
        <h2 className="mt-1 text-base font-bold text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SettingRow({
  icon,
  title,
  description,
  children
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface-low p-3">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-container text-primary">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{title}</p>
          {description ? <p className="mt-1 text-sm leading-5 text-muted">{description}</p> : null}
          {children}
        </div>
      </div>
    </div>
  );
}

function BudgetOptionCard({
  active,
  icon,
  title,
  description,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-[124px] flex-col items-start gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
        active
          ? "border-primary bg-primary/10 shadow-card"
          : "border-outline bg-background hover:border-primary/30"
      }`}
    >
      {active ? <CheckCircle2 size={16} className="absolute right-3 top-3 text-primary" /> : null}
      <div className="flex size-10 items-center justify-center rounded-2xl bg-surface text-primary shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      </div>
    </button>
  );
}
