import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/money";
import type { LedgerTransaction } from "@/lib/types";

const methodClass: Record<string, string> = {
  "CC BCA": "bg-[#dce9ff] text-[#003F72]",
  GoPay: "bg-[#dce9ff] text-[#006B7A]",
  "Transfer Masuk": "bg-[#85f8c4]/45 text-primary",
  Internal: "bg-[#e2dfff] text-secondary"
};

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
        <h3 className="truncate text-sm font-semibold text-ink">{transaction.merchant_name}</h3>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted">
          <span className="rounded-full bg-surface-low px-2 py-1 font-medium">{formatDateTime(transaction.occurred_at)}</span>
          {transaction.payment_method ? (
            <span className={`rounded-full px-2 py-1 font-medium ${methodClass[transaction.payment_method] ?? "bg-surface-container text-muted"}`}>{transaction.payment_method}</span>
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
