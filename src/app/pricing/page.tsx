import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Pricing } from "@/components/landing/pricing";
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
  const { isLoggedIn, plan, trialEndsAt } = token
    ? await resolveCurrentPlan(token)
    : { isLoggedIn: false, plan: "free" as const, trialEndsAt: null as null };

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
        <Pricing isLoggedIn={isLoggedIn} currentPlan={plan} trialEndsAt={trialEndsAt} />
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
