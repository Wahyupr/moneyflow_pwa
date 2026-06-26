"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlarmClock,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  Home,
  Landmark,
  Mic,
  Moon,
  PencilLine,
  PiggyBank,
  ReceiptText,
  ScanLine,
  Settings,
  ShieldCheck,
  Store,
  Sun,
  Tags,
  UserRound,
  WalletCards
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { ChatWidget } from "@/components/chat-widget";
import { PrivacyProvider } from "@/components/privacy-provider";
import { TopBar } from "@/components/top-bar";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type NavItem = { label: string; icon: LucideIcon; href: string; matchPrefix?: boolean };

const mainNav: NavItem[] = [
  { label: "Dashboard", icon: Home, href: "/dashboard" },
  { label: "Transaksi", icon: ReceiptText, href: "/transactions", matchPrefix: true },
  { label: "Laporan", icon: BarChart3, href: "/reports" },
];

const financeNav: NavItem[] = [
  { label: "Dompet", icon: WalletCards, href: "/wallets", matchPrefix: true },
  { label: "Budget", icon: PiggyBank, href: "/budgets" },
  { label: "Hutang", icon: Landmark, href: "/hutang" },
  { label: "Piutang", icon: HandCoins, href: "/piutang" },
  { label: "Pengingat", icon: AlarmClock, href: "/reminders" },
];

const toolNav: NavItem[] = [
  { label: "Input Manual", icon: PencilLine, href: "/transactions/new" },
  { label: "Input Suara", icon: Mic, href: "/voice-input" },
  { label: "Scan Struk", icon: ScanLine, href: "/scan-receipt" },
  { label: "Merchant", icon: Store, href: "/merchants" },
  { label: "Kategori", icon: Tags, href: "/categories" },
];

const bottomNav: NavItem[] = [
  { label: "Pengaturan", icon: Settings, href: "/settings" },
];

const adminNavItem: NavItem = { label: "Admin", icon: ShieldCheck, href: "/admin" };

function SideNavLink({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
  const Icon = item.icon;
  const active = pathname === item.href ||
    (item.matchPrefix ? pathname.startsWith(`${item.href}/`) : false);

  return (
    <Link
      title={collapsed ? item.label : undefined}
      className={`relative flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition active:scale-[0.98] ${
        collapsed ? "justify-center" : ""
      } ${
        active
          ? "bg-primary/10 font-bold text-primary"
          : "font-medium text-muted hover:bg-surface-low hover:text-ink"
      }`}
      href={item.href}
      aria-current={active ? "page" : undefined}
    >
      <Icon aria-hidden="true" size={17} strokeWidth={active ? 2.4 : 2} />
      {!collapsed && item.label}
    </Link>
  );
}

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
  const [displayName, setDisplayName] = useState<string>("...");
  const [collapsed, setCollapsed] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    let active = true;
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (!active) return;
        if (json?.profile?.role === "admin") setIsAdmin(true);
        const name = json?.profile?.display_name as string | undefined;
        if (name?.trim()) setDisplayName(name.trim());
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  return (
    <PrivacyProvider defaultHidden={defaultHidden}>
      <div className="min-h-dvh bg-background text-ink lg:flex">

        {/* ── Desktop Sidebar ── */}
        <aside className={`hidden h-dvh shrink-0 flex-col border-r border-surface-container bg-surface transition-all duration-300 lg:sticky lg:top-0 lg:flex ${collapsed ? "w-16" : "w-64"}`}>

          {/* Logo + toggle */}
          <div className={`flex items-center border-b border-surface-container px-3 py-4 ${collapsed ? "justify-center" : "gap-3 px-4"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/brand-mark.svg" alt="MoneyFlow" className="size-9 shrink-0 rounded-xl" />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-extrabold leading-none text-primary">MoneyFlow</h1>
                <p className="mt-0.5 text-[10px] text-muted">Modern Urban Finance</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-low hover:text-ink"
              aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            >
              {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>

          {/* Scrollable nav */}
          <nav className="flex-1 overflow-y-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

            {!collapsed && <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-muted/60">Utama</p>}
            {collapsed && <div className="my-1 h-px bg-surface-container" />}
            {mainNav.map((item) => (
              <SideNavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
            ))}

            {!collapsed && <p className="mb-1 mt-4 px-2 text-[10px] font-bold uppercase tracking-widest text-muted/60">Keuangan</p>}
            {collapsed && <div className="my-2 h-px bg-surface-container" />}
            {financeNav.map((item) => (
              <SideNavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
            ))}

            {!collapsed && <p className="mb-1 mt-4 px-2 text-[10px] font-bold uppercase tracking-widest text-muted/60">Alat</p>}
            {collapsed && <div className="my-2 h-px bg-surface-container" />}
            {toolNav.map((item) => (
              <SideNavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
            ))}

            {isAdmin && (
              <>
                {!collapsed && <p className="mb-1 mt-4 px-2 text-[10px] font-bold uppercase tracking-widest text-muted/60">Admin</p>}
                {collapsed && <div className="my-2 h-px bg-surface-container" />}
                <SideNavLink item={adminNavItem} pathname={pathname} collapsed={collapsed} />
              </>
            )}
          </nav>

          {/* Bottom: settings + user */}
          <div className="border-t border-surface-container px-2 py-3 space-y-1 shrink-0">
            {bottomNav.map((item) => (
              <SideNavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
            ))}
            {/* Dark mode toggle */}
            <button
              type="button"
              title={collapsed ? (resolvedTheme === "dark" ? "Mode Terang" : "Mode Malam") : undefined}
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className={`relative flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-low hover:text-ink active:scale-[0.98] ${collapsed ? "justify-center" : ""}`}
              aria-label={resolvedTheme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode malam"}
            >
              {resolvedTheme === "dark"
                ? <Sun size={17} strokeWidth={2} aria-hidden="true" />
                : <Moon size={17} strokeWidth={2} aria-hidden="true" />
              }
              {!collapsed && (resolvedTheme === "dark" ? "Mode Terang" : "Mode Malam")}
            </button>
            {!collapsed && (
              <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound size={16} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink">{displayName}</p>
                  <p className="text-[10px] text-muted">Akun saya</p>
                </div>
                <Bell size={15} className="text-muted" aria-hidden="true" />
              </div>
            )}
            {collapsed && (
              <div title={displayName} className="flex justify-center rounded-lg py-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound size={16} aria-hidden="true" />
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Page Content ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Desktop top-bar — sticky, full width */}
          <div className="hidden items-center justify-between border-b border-surface-container bg-background/95 px-6 py-3 backdrop-blur lg:sticky lg:top-0 lg:z-30 lg:flex">
            <div>
              <p className="text-xs text-muted">{subtitle ?? ""}</p>
              <h1 className="text-xl font-bold text-ink">{title ?? "Dashboard"}</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/notifications"
                className="flex size-9 items-center justify-center rounded-full bg-surface text-muted shadow-card hover:text-primary"
                aria-label="Notifikasi"
              >
                <Bell size={17} />
              </Link>
              <Link
                href="/settings"
                className="flex size-9 items-center justify-center rounded-full bg-surface text-muted shadow-card hover:text-primary"
                aria-label="Pengaturan"
              >
                <Settings size={17} />
              </Link>
            </div>
          </div>
          <main className="w-full px-4 pb-28 pt-[max(env(safe-area-inset-top),1rem)] md:px-6 lg:pb-10 lg:pt-4">
            {/* Mobile top-bar */}
            <div className="lg:hidden">
              <TopBar title={title} subtitle={subtitle} />
            </div>
            {children}
          </main>
        </div>

        <BottomNav />
      </div>
      {/* Rendered outside the flex layout so it always stacks correctly on all viewports */}
      <ChatWidget />
    </PrivacyProvider>
  );
}
