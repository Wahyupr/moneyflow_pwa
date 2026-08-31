import { getProviderLogo } from "@/lib/wallet-providers";

type ProviderLogoProps = {
  type: string;
  name: string;
  /** Size preset. sm = list rows, md = compact cards, lg = full cards. */
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASSES: Record<NonNullable<ProviderLogoProps["size"]>, string> = {
  sm: "px-1.5 py-0.5 text-[9px]",
  md: "px-2 py-0.5 text-[10px]",
  lg: "px-2.5 py-1 text-xs"
};

/**
 * Central brand-logo chip for wallet providers. Renders the provider wordmark
 * (e.g. "gopay", "DANA", "mandiri") on a white pill in the brand color so a
 * wallet card reads like the real product. Falls back to nothing when the
 * provider is unknown, letting callers decide on a neutral placeholder.
 *
 * This is the single source of truth for how a provider logo looks across the
 * app — the wallet card, the wallets list, and the form preview all use it.
 */
export function ProviderLogo({ type, name, size = "md" }: ProviderLogoProps) {
  const logo = getProviderLogo(type, name);
  if (!logo) return null;

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md bg-white font-black leading-none tracking-tight shadow-sm ${SIZE_CLASSES[size]}`}
      style={{ color: logo.textColor }}
    >
      <span className="truncate">{logo.text}</span>
    </span>
  );
}
