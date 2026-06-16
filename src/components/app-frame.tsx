"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Home, ReceiptText, Settings, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { PrivacyProvider } from "@/components/privacy-provider";
import { TopBar } from "@/components/top-bar";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type NavItem = { label: string; icon: LucideIcon; href: string };

const sideNav: NavItem[] = [
  { label: "Home", icon: Home, href: "/dashboard" },
  { label: "History", icon: ReceiptText, href: "/transactions" },
  { label: "Reports", icon: BarChart3, href: "/reports" },
  { label: "Settings", icon: Settings, href: "/settings" }
];

const adminNavItem: NavItem = { label: "Admin", icon: ShieldCheck, href: "/admin" };



export function AppFrame({
  title,
  subtitle,
  children,
  defaultHidden = false
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  defaultHidden?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (active && json?.profile?.role === "admin") {
          setIsAdmin(true);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const navItems = isAdmin ? [...sideNav, adminNavItem] : sideNav;

  return (

    <PrivacyProvider defaultHidden={defaultHidden}>
      <div className="min-h-dvh bg-background text-ink md:flex">
        <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-surface-container bg-surface px-4 py-6 md:sticky md:top-0 md:flex">
          <div className="mb-8 flex items-center gap-3 px-2">
            <img src="/brand-mark.svg" alt="MoneyFlow" className="size-10 rounded-lg" />
            <div>
              <h1 className="text-xl font-bold text-primary">MoneyFlow</h1>
              <p className="text-xs text-muted">Modern Urban Finance</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1">
            {navItems.map((item) => {

              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  className={`relative flex min-h-12 w-full items-center gap-4 px-5 py-2 text-sm transition active:scale-[0.98] ${
                    active ? "font-bold text-primary" : "font-semibold text-muted hover:bg-surface-low hover:text-ink"
                  }`}
                  href={item.href}
                  key={item.label}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
                  />
                  <Icon aria-hidden="true" size={19} strokeWidth={active ? 2.4 : 2} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-xl bg-surface-low p-4">
            <div className="flex items-center gap-3 text-sm font-semibold text-primary">
              <Bell size={18} />
              MoneyFlow
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">Review draft AI sebelum masuk ledger.</p>
          </div>
        </aside>

        <main className="mx-auto w-full max-w-3xl px-5 pb-28 pt-[max(env(safe-area-inset-top),1rem)] md:px-8 md:pb-10">
          <TopBar title={title} subtitle={subtitle} />
          {children}
        </main>
        <BottomNav />
      </div>
    </PrivacyProvider>
  );
}
