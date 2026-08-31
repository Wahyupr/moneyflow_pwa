import { CreditCard, Smartphone, UsersRound, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/money";
import { getProvider } from "@/lib/wallet-providers";

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

const TYPE_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Debit",
  ewallet: "E-Wallet",
  credit_card: "Credit",
  savings: "Savings",
  investment: "Invest"
};

/**
 * Formats an account/phone number the way a real card shows it: grouped in
 * fours with the middle digits masked, e.g. "•••• •••• •••• 1234". Falls back
 * to a generic masked group when there is no number to show.
 */
function formatCardNumber(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "•••• •••• •••• ••••";
  const last4 = digits.slice(-4).padStart(4, "•");
  return `•••• •••• •••• ${last4}`;
}

/** Gold EMV-style chip, drawn with CSS so it reads as a real payment card. */
function CardChip({ compact }: { compact: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative block overflow-hidden rounded-[5px] ${compact ? "h-6 w-8" : "h-8 w-11"}`}
      style={{ background: "linear-gradient(135deg, #F7D774 0%, #E6B23A 45%, #C98F1E 100%)" }}
    >
      <span className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="border border-black/25" />
        ))}
      </span>
      <span className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-black/20" />
    </span>
  );
}

export function WalletCard({ wallet, hidden, compact = false, onEdit, onDelete }: WalletCardProps) {
  const Icon = iconMap[wallet.icon as keyof typeof iconMap] ?? Wallet;

  // Provider drives the gradient end color so the card matches the brand.
  const provider = wallet.institution_name ? getProvider(wallet.type, wallet.institution_name) : null;
  const gradientEnd = provider?.colorEnd ?? "#213145";

  const typeLabel = TYPE_LABELS[wallet.type] ?? wallet.type.replace("_", " ");
  const balanceText = formatCurrency(wallet.balance_minor, "IDR");
  const numberSource = wallet.account_number ?? wallet.phone_number ?? null;

  // Only show the provider name beside the chip when it adds information — i.e.
  // when it isn't already reflected in the wallet name (avoids "BCA" twice).
  const institution = wallet.institution_name?.trim() ?? "";
  const showInstitution =
    institution.length > 0 && !wallet.name.trim().toLowerCase().includes(institution.toLowerCase());

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-2xl text-white shadow-lift ${compact ? "min-w-[210px] p-4" : "min-w-[248px] p-5"}`}
      style={{ background: `linear-gradient(135deg, ${wallet.color} 0%, ${gradientEnd} 100%)` }}
    >
      {/* Soft brand-tinted glow + concentric rings, like a physical card */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }}
      />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-14 -left-10 size-36 rounded-full border border-white/10" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-4 size-44 rounded-full border border-white/10" />

      {/* Header: type label + provider name (as thin text) + shared marker */}
      <header className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-semibold uppercase tracking-[0.18em] text-white/60 ${compact ? "text-[9px]" : "text-[10px]"}`}>
            {typeLabel}
          </p>
          <h3 className={`mt-1 font-bold leading-tight line-clamp-2 ${compact ? "text-sm" : "text-base"}`}>
            {wallet.name}
          </h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`flex items-center justify-center rounded-lg bg-white/15 ${compact ? "size-7" : "size-8"}`}>
            <Icon aria-hidden="true" size={compact ? 15 : 17} />
          </span>
          {wallet.shared ? <UsersRound aria-label="Dompet bersama" size={14} className="text-white/70" /> : null}
        </div>
      </header>

      {/* Chip + provider wordmark line (name hidden when it duplicates the title) */}
      <div className={`relative flex items-center gap-2.5 ${compact ? "mt-3" : "mt-4"}`}>
        <CardChip compact={compact} />
        {showInstitution ? (
          <span className={`truncate font-semibold uppercase tracking-wide text-white/75 ${compact ? "text-[10px]" : "text-xs"}`}>
            {institution}
          </span>
        ) : null}
      </div>

      {/* Masked card number */}
      <p className={`relative mt-2 font-mono tabular-nums tracking-[0.12em] text-white/85 ${compact ? "text-[11px]" : "text-sm"}`}>
        {formatCardNumber(numberSource)}
      </p>

      {/* Balance */}
      <div className={`relative ${compact ? "mt-3" : "mt-4"}`}>
        <p className={`font-medium uppercase tracking-[0.12em] text-white/55 ${compact ? "text-[8px]" : "text-[9px]"}`}>
          Saldo
        </p>
        <p className={`mt-0.5 font-bold tracking-[-0.02em] tabular-nums ${compact ? "text-lg leading-6" : "text-2xl leading-8"}`}>
          {hidden ? "•".repeat(Math.min(balanceText.length, 10)) : balanceText}
        </p>
      </div>

      {/* Full card actions */}
      {!compact && (onEdit || onDelete) ? (
        <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
          {onEdit ? (
            <button className="min-h-10 rounded-lg bg-white/15 text-xs font-bold backdrop-blur-sm active:scale-[0.98]" onClick={onEdit} type="button">
              Edit
            </button>
          ) : null}
          {onDelete ? (
            <button className="min-h-10 rounded-lg bg-white/15 text-xs font-bold backdrop-blur-sm active:scale-[0.98]" onClick={onDelete} type="button">
              Hapus
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
