import type { PlanTier, Result } from "./types";

// ─── Plan limits (single source of truth) ────────────────────────────────────

export const PLAN_LIMITS = {
  free: {
    wallets:              2,
    activeBudgets:        1,
    historyMonths:        3,
    voicePerDay:          1,
    scanPerDay:           7,   // 7 scans/month → daily cap treated as burst (7 per month)
    exportPerMonth:       1,
    aiInsightsPerMonth:   7,
    debtRecords:          1,
    sharedWallets:        1,
    reminders:            2,
    customMerchants:      3,
    customCategories:     3,
    aiChat:               false as const,
  },
  premium: {
    wallets:              null, // unlimited
    activeBudgets:        null,
    historyMonths:        null,
    voicePerDay:          null,
    scanPerDay:           2,    // 2 scans/day
    exportPerMonth:       null,
    aiInsightsPerMonth:   null,
    debtRecords:          null,
    sharedWallets:        null,
    reminders:            null,
    customMerchants:      null,
    customCategories:     null,
    aiChat:               false as const,
  },
  pro: {
    wallets:              null,
    activeBudgets:        null,
    historyMonths:        null,
    voicePerDay:          null,
    scanPerDay:           null,
    exportPerMonth:       null,
    aiInsightsPerMonth:   null,
    debtRecords:          null,
    sharedWallets:        null,
    reminders:            null,
    customMerchants:      null,
    customCategories:     null,
    aiChat:               true as const,
  },
} as const;

export type PlanLimits = typeof PLAN_LIMITS[PlanTier];

/** Returns null for unlimited, or the numeric cap for a given plan + feature. */
export function getLimit<K extends keyof typeof PLAN_LIMITS["free"]>(
  plan: PlanTier,
  feature: K
): (typeof PLAN_LIMITS)[PlanTier][K] {
  return PLAN_LIMITS[plan][feature] as (typeof PLAN_LIMITS)[PlanTier][K];
}

// ─── Entitlement checks ───────────────────────────────────────────────────────

export function canCreateWallet(input: { plan: PlanTier; walletCount: number }): Result {
  const max = PLAN_LIMITS[input.plan].wallets;
  if (max !== null && input.walletCount >= max) {
    return { ok: false, reason: `Paket ${input.plan} dibatasi maksimum ${max} dompet.` };
  }
  return { ok: true };
}

export function canCreateBudget(input: { plan: PlanTier; activeBudgetCount: number }): Result {
  const max = PLAN_LIMITS[input.plan].activeBudgets;
  if (max !== null && input.activeBudgetCount >= max) {
    return { ok: false, reason: `Paket ${input.plan} dibatasi maksimum ${max} budget aktif.` };
  }
  return { ok: true };
}

export function getReportWindowStart(input: { plan: PlanTier; now: Date }): string | null {
  const months = PLAN_LIMITS[input.plan].historyMonths;
  if (months === null) return null;
  return new Date(
    Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth() - months, 1)
  ).toISOString().slice(0, 10);
}

export function canAccessHutangPiutang(input: { plan: PlanTier; recordCount: number }): Result {
  const max = PLAN_LIMITS[input.plan].debtRecords;
  if (max !== null && input.recordCount >= max) {
    return {
      ok: false,
      reason: `Paket free dibatasi ${max} catatan hutang/piutang. Upgrade ke Premium untuk lebih banyak.`,
    };
  }
  return { ok: true };
}

export function canCreateReminder(input: { plan: PlanTier; reminderCount: number }): Result {
  const max = PLAN_LIMITS[input.plan].reminders;
  if (max !== null && input.reminderCount >= max) {
    return {
      ok: false,
      reason: `Paket ${input.plan} dibatasi maksimum ${max} pengingat tagihan.`,
    };
  }
  return { ok: true };
}

export function canCreateCustomMerchant(input: { plan: PlanTier; merchantCount: number }): Result {
  const max = PLAN_LIMITS[input.plan].customMerchants;
  if (max !== null && input.merchantCount >= max) {
    return {
      ok: false,
      reason: `Paket ${input.plan} dibatasi maksimum ${max} merchant kustom.`,
    };
  }
  return { ok: true };
}

export function canCreateCustomCategory(input: { plan: PlanTier; categoryCount: number }): Result {
  const max = PLAN_LIMITS[input.plan].customCategories;
  if (max !== null && input.categoryCount >= max) {
    return {
      ok: false,
      reason: `Paket ${input.plan} dibatasi maksimum ${max} kategori kustom.`,
    };
  }
  return { ok: true };
}

export function canUseVoiceInput(input: { plan: PlanTier; voiceUsedToday: number }): Result {
  const max = PLAN_LIMITS[input.plan].voicePerDay;
  if (max !== null && input.voiceUsedToday >= max) {
    return {
      ok: false,
      reason: `Paket ${input.plan} dibatasi ${max}× voice input per hari.`,
    };
  }
  return { ok: true };
}

export function canScanReceipt(input: { plan: PlanTier; scansToday: number; scansThisMonth: number }): Result {
  const maxPerDay = PLAN_LIMITS[input.plan].scanPerDay;
  if (maxPerDay !== null && input.scansToday >= maxPerDay) {
    return {
      ok: false,
      reason: `Paket ${input.plan} dibatasi ${maxPerDay}× scan struk per hari.`,
    };
  }
  // Free uses monthly quota instead of daily
  if (input.plan === "free" && input.scansThisMonth >= 7) {
    return { ok: false, reason: "Paket free dibatasi 7× scan struk per bulan." };
  }
  return { ok: true };
}

export function canExportReport(input: { plan: PlanTier; exportsThisMonth: number }): Result {
  const max = PLAN_LIMITS[input.plan].exportPerMonth;
  if (max !== null && input.exportsThisMonth >= max) {
    return {
      ok: false,
      reason: `Paket ${input.plan} dibatasi ${max}× ekspor per bulan.`,
    };
  }
  return { ok: true };
}

export function canUseAiInsights(input: { plan: PlanTier; insightsThisMonth: number }): Result {
  const max = PLAN_LIMITS[input.plan].aiInsightsPerMonth;
  if (max !== null && input.insightsThisMonth >= max) {
    return {
      ok: false,
      reason: `Paket ${input.plan} dibatasi ${max}× AI Insights per bulan.`,
    };
  }
  return { ok: true };
}

export function canUseAiChat(plan: PlanTier): Result {
  if (!PLAN_LIMITS[plan].aiChat) {
    return { ok: false, reason: "AI Asisten Chat hanya tersedia di paket Pro." };
  }
  return { ok: true };
}

export const DEBT_CATEGORIES: string[] = [
  "KPR",
  "Cicilan Kendaraan",
  "Pinjaman Pribadi",
  "Kartu Kredit",
  "Pinjaman Pendidikan",
  "Pinjaman Online",
  "Pinjaman Bisnis",
  "Pinjaman Teman atau Keluarga",
  "Cicilan Elektronik",
  "Renovasi Rumah",
  "Pinjaman Medis"
];
