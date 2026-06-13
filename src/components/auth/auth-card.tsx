import Link from "next/link";
import type { ReactNode } from "react";
import { WalletCards } from "lucide-react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-background px-5 py-10 text-ink">
      <div className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-primary-container/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-1/2 size-72 rounded-full bg-surface-highest/70 blur-3xl" />

      <section className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary-container text-white shadow-card">
            <WalletCards aria-hidden="true" size={34} strokeWidth={2.2} />
          </div>
          <Link className="text-2xl font-bold text-primary" href="/">
            MoneyFlow
          </Link>
          <p className="mt-2 text-base leading-6 text-muted">{subtitle}</p>
        </div>

        <div className="rounded-xl border border-white/60 bg-white/85 p-6 shadow-lift backdrop-blur-xl">
          <h1 className="mb-5 text-xl font-bold text-ink">{title}</h1>
          {children}
        </div>

        <div className="mt-6 text-center text-sm text-muted">{footer}</div>
      </section>
    </main>
  );
}
