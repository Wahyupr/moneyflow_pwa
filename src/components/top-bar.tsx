"use client";

import Link from "next/link";
import { Bell, UserRound } from "lucide-react";

export function TopBar({ title = "MoneyFlow", subtitle }: { title?: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-50 -mx-5 flex min-h-16 items-center justify-between bg-background/95 px-5 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0">
      <Link
        className="flex size-10 items-center justify-center rounded-full bg-surface-container text-primary shadow-card active:scale-95 md:hidden"
        href="/settings"
        aria-label="Buka pengaturan"
      >
        <UserRound size={20} />
      </Link>
      <div className="min-w-0 flex-1 px-3 md:px-0">
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        <h1 className="truncate text-xl font-bold text-primary">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Link
          aria-label="Notifikasi"
          className="flex size-10 items-center justify-center rounded-full bg-surface text-primary shadow-card active:scale-95"
          href="/reminders"
        >
          <Bell size={19} />
        </Link>
        <Link
          className="hidden size-10 items-center justify-center rounded-full bg-surface-container text-primary shadow-card active:scale-95 md:flex"
          href="/settings"
          aria-label="Buka pengaturan"
        >
          <UserRound size={20} />
        </Link>
      </div>
    </header>
  );
}
