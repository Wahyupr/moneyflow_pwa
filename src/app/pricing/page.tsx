import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Pricing, type FeatureRow } from "@/components/landing/pricing";
import { AUTH_COOKIE_NAME } from "@/lib/auth/token";
import { verifySessionToken } from "@/lib/auth/session";
import { query } from "@/lib/db/pool";
import Link from "next/link";
import Image from "next/image";

// Force dynamic so cookies() always reflects the live session — never serve
// a cached version where isLoggedIn would be stale.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Harga — MoneyFlow",
  description:
    "Pilih paket MoneyFlow yang sesuai. Gratis untuk mulai, Premium & Pro untuk pengguna serius.",
};

type PlanLimitRow = {
  plan: string;
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
};

function fmtLimit(v: number | null, unit: string): string {
  return v === null ? `Tak terbatas` : `${v} ${unit}`;
}

function buildFeatureRows(limits: PlanLimitRow[]): FeatureRow[] {
  const free    = limits.find((l) => l.plan === "free");
  const premium = limits.find((l) => l.plan === "premium");
  const pro     = limits.find((l) => l.plan === "pro");
  if (!free || !premium || !pro) return [];

  return [
    {
      label: "Kredit AI / siklus",
      free:    fmtLimit(free.ai_credits_per_cycle,    "kredit"),
      premium: fmtLimit(premium.ai_credits_per_cycle, "kredit"),
      pro:     fmtLimit(pro.ai_credits_per_cycle,     "kredit"),
    },
    {
      label: "Dompet",
      free:    free.wallets    === null ? "Tak terbatas"                   : `Maks. ${free.wallets} dompet`,
      premium: premium.wallets === null ? "Jumlah dompet tak terbatas"     : `Maks. ${premium.wallets} dompet`,
      pro:     pro.wallets     === null ? "Jumlah dompet tak terbatas"     : `Maks. ${pro.wallets} dompet`,
    },
    {
      label: "Budget aktif",
      free:    free.active_budgets    === null ? "Tak terbatas"             : `${free.active_budgets} budget aktif`,
      premium: premium.active_budgets === null ? "Jumlah budget tak terbatas" : `${premium.active_budgets} budget aktif`,
      pro:     pro.active_budgets     === null ? "Jumlah budget tak terbatas" : `${pro.active_budgets} budget aktif`,
    },
    {
      label: "Riwayat transaksi",
      free:    free.history_months    === null ? "Seluruh riwayat"          : `${free.history_months} bulan terakhir saja`,
      premium: premium.history_months === null ? "Seluruh riwayat"          : `${premium.history_months} bulan terakhir`,
      pro:     pro.history_months     === null ? "Seluruh riwayat"          : `${pro.history_months} bulan terakhir`,
    },
    {
      label: "Input suara",
      free:    free.voice_per_day    === null ? "Tak terbatas"              : `Voice input ${free.voice_per_day}× sehari`,
      premium: premium.voice_per_day === null ? "Voice input unlimited"     : `Voice input ${premium.voice_per_day}× sehari`,
      pro:     pro.voice_per_day     === null ? "Voice input unlimited"     : `Voice input ${pro.voice_per_day}× sehari`,
    },
    {
      label: "Scan struk otomatis",
      free:    free.scan_per_day    === null ? "Tak terbatas"               : `${free.scan_per_day}× sehari — AI baca & isi transaksi`,
      premium: premium.scan_per_day === null ? "Scan struk tak terbatas"    : `Scan struk ${premium.scan_per_day}× sehari`,
      pro:     pro.scan_per_day     === null ? "Scan struk tak terbatas"    : `Scan struk ${pro.scan_per_day}× sehari`,
    },
    {
      label: "Ekspor laporan Excel",
      free:    free.export_per_month    === null ? "Tak terbatas"           : `${free.export_per_month}×/bln — unduh ringkasan transaksi`,
      premium: premium.export_per_month === null ? "Unduh laporan unlimited": `${premium.export_per_month}×/bln`,
      pro:     pro.export_per_month     === null ? "Unduh laporan unlimited": `${pro.export_per_month}×/bln`,
    },
    {
      label: "AI Insights",
      free:    free.ai_insights_per_month    === null ? "Tak terbatas"      : `${free.ai_insights_per_month}× sebulan AI Insights`,
      premium: premium.ai_insights_per_month === null ? "AI Insights tak terbatas" : `${premium.ai_insights_per_month}× sebulan`,
      pro:     pro.ai_insights_per_month     === null ? "AI Insights tak terbatas" : `${pro.ai_insights_per_month}× sebulan`,
    },
    {
      label: "Hutang & Piutang",
      free:    free.debt_records    === null ? "Tak terbatas"               : `${free.debt_records} catatan hutang/piutang`,
      premium: premium.debt_records === null ? "Catat & lacak hutang/piutang tak terbatas" : `${premium.debt_records} catatan`,
      pro:     pro.debt_records     === null ? "Catat & lacak hutang/piutang tak terbatas" : `${pro.debt_records} catatan`,
    },
    {
      label: "Multi dompet berbagi",
      free:    free.shared_wallets    === null ? "Tak terbatas"             : `${free.shared_wallets} dompet bersama`,
      premium: premium.shared_wallets === null ? "Dompet bareng keluarga/pasangan tak terbatas" : `${premium.shared_wallets} dompet bersama`,
      pro:     pro.shared_wallets     === null ? "Dompet bareng keluarga/pasangan tak terbatas" : `${pro.shared_wallets} dompet bersama`,
    },
    {
      label: "Pengingat tagihan",
      free:    free.reminders    === null ? "Tak terbatas"                  : `Maks. ${free.reminders} pengingat tagihan`,
      premium: premium.reminders === null ? "Pengingat tagihan tak terbatas": `Maks. ${premium.reminders} pengingat`,
      pro:     pro.reminders     === null ? "Pengingat tagihan tak terbatas": `Maks. ${pro.reminders} pengingat`,
    },
    {
      label: "Custom Merchant",
      free:    free.custom_merchants    === null ? "Tak terbatas"           : `Maks. ${free.custom_merchants} merchant kustom`,
      premium: premium.custom_merchants === null ? "Merchant kustom tak terbatas" : `${premium.custom_merchants} merchant`,
      pro:     pro.custom_merchants     === null ? "Merchant kustom tak terbatas" : `${pro.custom_merchants} merchant`,
    },
    {
      label: "Custom Kategori",
      free:    free.custom_categories    === null ? "Tak terbatas"          : `Maks. ${free.custom_categories} kategori kustom`,
      premium: premium.custom_categories === null ? "Kategori kustom tak terbatas" : `${premium.custom_categories} kategori`,
      pro:     pro.custom_categories     === null ? "Kategori kustom tak terbatas" : `${pro.custom_categories} kategori`,
    },
    {
      label: "AI Asisten Chat",
      free:    free.ai_chat    ? "Tanya jawab keuangan interaktif" : false,
      premium: premium.ai_chat ? "Tanya jawab keuangan interaktif" : false,
      pro:     pro.ai_chat     ? "Tanya jawab keuangan interaktif" : false,
    },
  ];
}

async function resolvePlanLimits(): Promise<FeatureRow[]> {
  try {
    const res = await query<PlanLimitRow>(`select * from plan_limits order by plan`);
    const rows = buildFeatureRows(res.rows);
    return rows.length > 0 ? rows : [];
  } catch {
    return [];
  }
}

/** Reads the viewer's current active plan + trial expiry date. */
async function resolveCurrentPlan(token: string): Promise<{
  isLoggedIn: boolean;
  plan: "free" | "premium" | "pro";
  trialEndsAt: string | null;
}> {
  let session: { id: string } | null = null;
  try {
    session = verifySessionToken(token);
  } catch {
    session = null;
  }
  if (!session) return { isLoggedIn: false, plan: "free", trialEndsAt: null };

  try {
    const res = await query<{ plan: string; current_period_end: string | null; is_trial: boolean | null }>(
      `select plan, current_period_end,
              (source = 'trial') as is_trial
       from subscription_entitlements
       where user_id = $1 and status = 'active'
         and (current_period_end is null or current_period_end > now())
       order by case plan when 'pro' then 0 when 'premium' then 1 else 2 end
       limit 1`,
      [session.id]
    );
    const row = res.rows[0];
    const plan = row?.plan === "premium" || row?.plan === "pro" ? row.plan : "free";
    const trialEndsAt = row?.is_trial && row?.current_period_end ? row.current_period_end : null;
    return { isLoggedIn: true, plan, trialEndsAt };
  } catch {
    return { isLoggedIn: true, plan: "free", trialEndsAt: null };
  }
}

export default async function PricingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value ?? "";
  const [{ isLoggedIn, plan, trialEndsAt }, featureRows] = await Promise.all([
    token ? resolveCurrentPlan(token) : Promise.resolve({ isLoggedIn: false, plan: "free" as const, trialEndsAt: null as null }),
    resolvePlanLimits(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav — adapts to auth state */}
      <header className="sticky top-0 z-40 border-b border-outline bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href={isLoggedIn ? "/dashboard" : "/"} className="flex items-center gap-2.5">
            <Image
              src="/logo/icon-192.png"
              alt="MoneyFlow"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-extrabold tracking-tight">MoneyFlow</span>
          </Link>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-card transition hover:opacity-90 active:scale-[0.97]"
              >
                Dashboard →
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-muted transition hover:text-ink"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-card transition hover:opacity-90 active:scale-[0.97]"
                >
                  Daftar Gratis
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <Pricing isLoggedIn={isLoggedIn} currentPlan={plan} trialEndsAt={trialEndsAt} featureRows={featureRows.length > 0 ? featureRows : undefined} />
      </main>

      <footer className="border-t border-outline py-8 text-center text-sm text-muted">
        <p>
          &copy; {new Date().getFullYear()} MoneyFlow.{" "}
          <Link href="/syarat-ketentuan" className="hover:underline">
            Syarat &amp; Ketentuan
          </Link>{" "}
          &middot;{" "}
          <Link href="/kebijakan-refund" className="hover:underline">
            Kebijakan Refund
          </Link>{" "}
          &middot;{" "}
          <Link href="/kontak" className="hover:underline">
            Kontak
          </Link>
        </p>
      </footer>
    </div>
  );
}
