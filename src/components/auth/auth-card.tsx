import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  below
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  below?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-background px-5 py-10 text-ink">
      <div className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-primary-container/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-1/2 size-72 rounded-full bg-surface-highest/70 blur-3xl" />

      <section className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/icon-192.png" alt="MoneyFlow" className="mb-4 size-16 rounded-2xl shadow-card" />
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

        {below ? <div className="mt-4">{below}</div> : null}
      </section>
    </main>
  );
}
