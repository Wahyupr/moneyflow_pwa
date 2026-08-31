import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, PenLine } from "lucide-react";
import { formatCurrency } from "@/lib/money";
import { getCategoryIcon } from "@/lib/category-icons";
import { getProviderLogo } from "@/lib/wallet-providers";
import type { LedgerTransaction } from "@/lib/types";

const methodClass: Record<string, string> = {
  "CC BCA": "bg-[#dce9ff] text-[#003F72]",
  GoPay: "bg-[#dce9ff] text-[#006B7A]",
  "Transfer Masuk": "bg-[#85f8c4]/45 text-primary",
  Internal: "bg-[#e2dfff] text-secondary"
};

const INPUT_METHOD_LABEL: Record<string, string> = {
  manual: "Input Manual",
  receipt_scan: "Scan Struk",
  evidence_upload: "Upload Bukti",
  voice: "Suara",
  auto_recurring: "Otomatis",
  chat: "Chat AI",
  reminder: "Pengingat"
};

function inputMethodLabel(value: string): string {
  return INPUT_METHOD_LABEL[value] ?? value;
}

/**
 * Small wallet marker shown on the wallet line. Renders the provider brand logo
 * (GoPay, BCA, ...) when the wallet has one; otherwise falls back to a dot in
 * the wallet's own card color so it still reads as "the wallet" rather than a
 * generic icon.
 */
function WalletBadge({
  type,
  institution,
  color
}: {
  type: string | null | undefined;
  institution: string | null | undefined;
  color: string | null | undefined;
}) {
  const logo = type && institution ? getProviderLogo(type, institution) : null;

  if (logo) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center rounded-[3px] bg-white px-1 text-[8px] font-black leading-none shadow-sm ring-1 ring-black/5"
        style={{ color: logo.textColor }}
      >
        {logo.text}
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color ?? "#94a3b8" }}
    />
  );
}

/** Formats a transaction timestamp as a short Indonesian date + time. */
function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}


export function TransactionRow({ transaction, hidden }: { transaction: LedgerTransaction; hidden: boolean }) {
  const income = transaction.transaction_type === "income";
  const transfer = transaction.transfer_pair_id !== null || transaction.transaction_type === "transfer";
  const amount = `${income ? "+" : "-"}${formatCurrency(transaction.amount_minor, "IDR")}`;
  const toneClass = transfer
    ? "bg-[#e2dfff] text-transfer"
    : income
      ? "bg-[#85f8c4]/45 text-income"
      : "bg-[#ffdad6] text-expense";

  const CategoryIcon = transaction.category_name ? getCategoryIcon(transaction.category_icon) : null;

  // When the wallet has a provider logo AND its name just repeats that provider
  // (e.g. logo "BCA" + name "BCA"), show only the logo chip to avoid duplication.
  const walletInstitution = transaction.wallet_institution_name?.trim() ?? "";
  const walletName = transaction.wallet_name?.trim() ?? "";
  const hasWalletLogo = Boolean(
    transaction.wallet_type && walletInstitution && getProviderLogo(transaction.wallet_type, walletInstitution)
  );
  const showWalletName = !(hasWalletLogo && walletName.toLowerCase() === walletInstitution.toLowerCase());

  return (
    <article className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-lg bg-surface p-3 shadow-card transition active:scale-[0.99]">
      {transaction.merchant_logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={transaction.merchant_name ?? "Merchant"} className="size-11 rounded-full object-cover" src={transaction.merchant_logo_url} />
      ) : (
        <div className={`flex size-11 items-center justify-center rounded-full ${toneClass}`}>
          {transfer ? <ArrowRightLeft aria-hidden="true" size={18} /> : income ? <ArrowDownLeft aria-hidden="true" size={18} /> : <ArrowUpRight aria-hidden="true" size={18} />}
        </div>
      )}

      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-ink">
          {transaction.merchant_name ?? (transaction.note ? transaction.note : "Transaksi")}
        </h3>

        {/* Wallet + category line: always shows where the money moved and what it's for. */}
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted">
          {transaction.wallet_name ? (
            <span className="inline-flex items-center gap-1 truncate">
              <WalletBadge
                type={transaction.wallet_type}
                institution={transaction.wallet_institution_name}
                color={transaction.wallet_color}
              />
              {showWalletName ? transaction.wallet_name : null}
            </span>
          ) : null}
          {transaction.wallet_name && transaction.category_name ? <span aria-hidden="true">·</span> : null}
          {transaction.category_name ? (
            <span
              className="inline-flex items-center gap-1 truncate font-medium"
              style={transaction.category_color ? { color: transaction.category_color } : undefined}
            >
              {CategoryIcon ? <CategoryIcon aria-hidden="true" size={11} className="shrink-0" /> : null}
              {transaction.category_name}
            </span>
          ) : null}
        </div>

        {/* Note line, shown separately so it doesn't crowd the title (esp. for manual input without a merchant). */}
        {transaction.note && transaction.merchant_name ? (
          <p className="mt-0.5 truncate text-[11px] text-muted/80">{transaction.note}</p>
        ) : null}

        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted">
          <span className="rounded-full bg-surface-low px-2 py-1 font-medium">{formatDateTime(transaction.occurred_at)}</span>
          {transaction.payment_method ? (
            <span className={`rounded-full px-2 py-1 font-medium ${methodClass[transaction.payment_method] ?? "bg-surface-container text-muted"}`}>{transaction.payment_method}</span>
          ) : null}
          {transaction.input_method ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-1 font-medium text-muted">
              <PenLine aria-hidden="true" size={10} />
              {inputMethodLabel(transaction.input_method)}
            </span>
          ) : null}
          {transaction.created_by_name ? (
            <span className="rounded-full bg-surface-container px-2 py-1 font-medium text-muted">
              oleh {transaction.created_by_name}
            </span>
          ) : null}
        </div>
      </div>

      <p className={`text-sm font-bold tabular-nums ${transfer ? "text-transfer" : income ? "text-income" : "text-expense"}`}>
        {hidden ? "******" : amount}
      </p>
    </article>
  );
}
