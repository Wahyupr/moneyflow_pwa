import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Pricing } from "@/components/landing/pricing";
import { AUTH_COOKIE_NAME } from "@/lib/auth/token";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Harga — MoneyFlow",
  description:
    "Pilih paket MoneyFlow yang sesuai. Gratis untuk mulai, Premium & Pro untuk pengguna serius.",
};

/** Cheap structural check — same logic as middleware. No DB hit needed. */
function hasValidTokenShape(token: string): boolean {
  const segments = token.split(".");
  if (segments.length !== 3) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(segments[1], "base64url").toString("utf8")
    ) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export default async function PricingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value ?? "";
  const isLoggedIn = token ? hasValidTokenShape(token) : false;

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
        <Pricing isLoggedIn={isLoggedIn} />
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
