"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Plus, ReceiptText, WalletCards } from "lucide-react";
import { useState } from "react";
import { AddActionSheet } from "@/components/add-action-sheet";

const items = [
  { label: "Home", icon: Home, href: "/dashboard", match: ["/dashboard"] },
  { label: "History", icon: ReceiptText, href: "/transactions", match: ["/transactions"] },
  { label: "Reports", icon: BarChart3, href: "/reports", match: ["/reports"] },
  { label: "Wallets", icon: WalletCards, href: "/wallets", match: ["/wallets"] }
];

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-surface-container bg-surface/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-6px_24px_rgba(11,28,48,0.06)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end gap-1">
          <NavItem item={items[0]} pathname={pathname} />
          <NavItem item={items[1]} pathname={pathname} />
          <button
            className="-mt-8 flex size-16 flex-col items-center justify-center rounded-full bg-primary text-white shadow-lift transition active:scale-95"
            onClick={() => setAddOpen(true)}
            type="button"
            aria-label="Tambah transaksi"
          >
            <Plus aria-hidden="true" size={28} strokeWidth={2.4} />
          </button>
          <NavItem item={items[2]} pathname={pathname} />
          <NavItem item={items[3]} pathname={pathname} />
        </div>
      </nav>
      <AddActionSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function NavItem({ item, pathname }: { item: (typeof items)[number]; pathname: string }) {
  const Icon = item.icon;
  const active = item.match.some((match) => pathname === match || pathname.startsWith(`${match}/`));

  return (
    <Link
      className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] transition ${
        active ? "bg-primary-container text-white" : "text-muted active:bg-surface-container"
      }`}
      href={item.href}
      aria-current={active ? "page" : undefined}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={2} />
      <span>{item.label}</span>
    </Link>
  );
}
