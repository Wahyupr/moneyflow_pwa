"use client";

import { useState } from "react";
import { ChevronDown, UsersRound } from "lucide-react";
import { formatCurrency } from "@/lib/money";
import { getProvider } from "@/lib/wallet-providers";
import { ProviderLogo } from "@/components/provider-logo";
import type { DashboardWallet } from "@/lib/dashboard";

type WalletStackProps = {
  wallets: DashboardWallet[];
  hidden: boolean;
};

/** Height of the visible strip for a card that sits behind another (px). */
const PEEK = 62;
/** Full height of the front (fully visible) card (px). */
const CARD_HEIGHT = 104;
/** Vertical gap between cards when the stack is expanded (px). */
const EXPANDED_GAP = 12;

/**
 * Renders wallets as a stacked "cardholder": cards overlap vertically so only
 * a strip (brand + balance) of each card behind peeks out, while the front card
 * shows in full — mimicking cards tucked into a wallet holder. Tapping the stack
 * fans the cards out so every card is fully readable, and tapping again tucks
 * them back.
 */
export function WalletStack({ wallets, hidden }: WalletStackProps) {
  const [expanded, setExpanded] = useState(false);

  if (wallets.length === 0) return null;

  // Total height so the absolutely-flowing cards reserve the right space.
  const collapsedHeight = PEEK * (wallets.length - 1) + CARD_HEIGHT;
  const expandedHeight = (CARD_HEIGHT + EXPANDED_GAP) * wallets.length - EXPANDED_GAP;

  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      aria-label={expanded ? "Tutup tumpukan dompet" : "Buka tumpukan dompet"}
      className="relative block w-full text-left transition-[height] duration-300 ease-out"
      style={{ height: expanded ? expandedHeight : collapsedHeight }}
    >
      {wallets.map((wallet, index) => {
        const provider = getProvider(wallet.type, wallet.name);
        const gradientEnd = provider?.colorEnd ?? "#213145";
        const isFront = index === wallets.length - 1;
        const offset = expanded
          ? index * (CARD_HEIGHT + EXPANDED_GAP)
          : index * PEEK;
        const balanceText = formatCurrency(wallet.balance_minor, "IDR");

        return (
          <article
            key={wallet.id}
            className="absolute inset-x-0 overflow-hidden rounded-2xl px-5 pt-4 text-white shadow-[0_-3px_14px_rgba(0,0,0,0.22)] transition-[top] duration-300 ease-out"
            style={{
              top: offset,
              height: CARD_HEIGHT,
              zIndex: index + 1,
              background: `linear-gradient(135deg, ${wallet.color}, ${gradientEnd})`
            }}
          >
            {/* Subtle sheen so the plastic-card look reads even without an icon */}
            <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-white/10 blur-2xl" />

            {/* Visible strip: brand name on the left, balance on the right */}
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {provider ? (
                  <ProviderLogo type={wallet.type} name={wallet.name} size="md" />
                ) : null}
                <span className="min-w-0 truncate text-lg font-extrabold tracking-tight">
                  {wallet.name}
                </span>
                {wallet.shared ? (
                  <UsersRound aria-label="Dompet bersama" size={14} className="shrink-0 text-white/80" />
                ) : null}
              </div>
              <p className="shrink-0 text-right text-lg font-extrabold tracking-[-0.01em] tabular-nums">
                {hidden ? "*".repeat(Math.min(10, balanceText.length)) : balanceText}
              </p>
            </div>

            {/* Lower detail row */}
            <div className="relative mt-4 flex items-center justify-between text-[11px] font-semibold text-white/70">
              <span>{hidden ? "****" : `Masuk ${formatCurrency(wallet.income_minor, "IDR")}`}</span>
              <span>{hidden ? "****" : `Keluar ${formatCurrency(wallet.expense_minor, "IDR")}`}</span>
            </div>

            {/* Expand affordance on the front card while stacked */}
            {isFront && !expanded && wallets.length > 1 ? (
              <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-white/70">
                <ChevronDown size={16} />
              </span>
            ) : null}
          </article>
        );
      })}
    </button>
  );
}
