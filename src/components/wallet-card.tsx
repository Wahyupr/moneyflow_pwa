import { CreditCard, Smartphone, UsersRound, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/money";

const iconMap = {
  "credit-card": CreditCard,
  smartphone: Smartphone,
  users: UsersRound,
  wallet: Wallet
};

type WalletCardProps = {
  wallet: {
    id?: string;
    name: string;
    balance_minor: number;
    income_minor?: number;
    expense_minor?: number;
    type: string;
    color: string;
    icon: string;
    shared?: boolean;
    institution_name?: string | null;
    account_number?: string | null;
    phone_number?: string | null;
  };
  hidden: boolean;
  compact?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function WalletCard({ wallet, hidden, compact = false, onEdit, onDelete }: WalletCardProps) {
  const Icon = iconMap[wallet.icon as keyof typeof iconMap] ?? Wallet;
  const incomeMinor = wallet.income_minor ?? 0;
  const expenseMinor = wallet.expense_minor ?? 0;
  const progress = Math.min(100, (expenseMinor / Math.max(incomeMinor + expenseMinor, 1)) * 100);

  return (
    <article
      className={`relative overflow-hidden rounded-xl text-white shadow-card ${compact ? "min-w-[158px] p-3" : "min-w-[220px] p-4"}`}
      style={{ background: `linear-gradient(135deg, ${wallet.color}, #213145)` }}
    >
      <div className="absolute -bottom-9 -right-7 opacity-10">
        <Icon aria-hidden="true" size={compact ? 72 : 92} strokeWidth={1.5} />
      </div>
      <div className="flex items-center justify-between">
        <div className={`flex items-center justify-center rounded-lg bg-white/15 ${compact ? "size-8" : "size-9"}`}>
          <Icon aria-hidden="true" size={compact ? 16 : 18} />
        </div>
        {wallet.shared ? <UsersRound aria-label="Shared wallet" size={18} /> : null}
      </div>
      <p className={`${compact ? "mt-3" : "mt-4"} text-[11px] font-bold uppercase tracking-[0.05em] text-white/75`}>{wallet.type.replace("_", " ")}</p>
      <h3 className={`mt-1 truncate font-semibold ${compact ? "text-sm" : "text-base"}`}>{wallet.name}</h3>
      <p className={`mt-2 truncate font-bold tracking-[-0.02em] tabular-nums ${compact ? "text-lg leading-6" : "text-[22px] leading-7"}`}>
        {hidden ? "*".repeat(formatCurrency(wallet.balance_minor, "IDR").length) : formatCurrency(wallet.balance_minor, "IDR")}
      </p>
      <div className={`${compact ? "mt-3" : "mt-4"} h-1.5 rounded-full bg-white/20`}>
        <div className="h-full rounded-full bg-[#85f8c4]" style={{ width: `${progress}%` }} />
      </div>
      {!compact ? (
        <>
          <div className="mt-3 flex justify-between gap-3 text-[11px] font-semibold text-white/80">
            <span className="truncate">{hidden ? "****" : `Masuk ${formatCurrency(incomeMinor, "IDR")}`}</span>
            <span className="truncate">{hidden ? "****" : `Keluar ${formatCurrency(expenseMinor, "IDR")}`}</span>
          </div>
          {wallet.institution_name || wallet.account_number || wallet.phone_number ? (
            <p className="mt-3 truncate text-xs text-white/75">{wallet.institution_name ?? wallet.account_number ?? wallet.phone_number}</p>
          ) : null}
          {onEdit || onDelete ? (
            <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
              {onEdit ? (
                <button className="min-h-10 rounded-lg bg-white/15 text-xs font-bold active:scale-[0.98]" onClick={onEdit} type="button">
                  Edit
                </button>
              ) : null}
              {onDelete ? (
                <button className="min-h-10 rounded-lg bg-white/15 text-xs font-bold active:scale-[0.98]" onClick={onDelete} type="button">
                  Hapus
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
