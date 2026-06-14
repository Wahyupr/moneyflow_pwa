/**
 * Master data for Indonesian wallet providers (e-wallets & banks) plus their
 * brand colors. Used by the wallet form so an admin/user picks a provider from
 * a dropdown instead of typing a name, and the wallet card color is set
 * automatically from the provider's brand color.
 *
 * `institution_name` on the wallet stores the chosen provider's name.
 */

export type WalletProvider = {
  /** Provider name stored in wallets.institution_name. */
  name: string;
  /** Brand color used as the wallet card color (hex). */
  color: string;
};

/** Popular Indonesian e-wallets. */
export const EWALLET_PROVIDERS: WalletProvider[] = [
  { name: "GoPay", color: "#00AED6" },
  { name: "OVO", color: "#4C2A86" },
  { name: "DANA", color: "#108EE9" },
  { name: "ShopeePay", color: "#EE4D2D" },
  { name: "LinkAja", color: "#E82127" },
  { name: "Sakuku", color: "#005BAC" },
  { name: "i.saku", color: "#E4002B" },
  { name: "Jenius Pay", color: "#00B2A9" }
];

/** Common Indonesian banks. */
export const BANK_PROVIDERS: WalletProvider[] = [
  { name: "BCA", color: "#005BAC" },
  { name: "Bank Mandiri", color: "#003D79" },
  { name: "BRI", color: "#00529C" },
  { name: "BNI", color: "#F15A22" },
  { name: "BSI", color: "#00A39D" },
  { name: "CIMB Niaga", color: "#7A0019" },
  { name: "Bank Danamon", color: "#005CAB" },
  { name: "Permata Bank", color: "#005EB8" },
  { name: "Bank BTN", color: "#00529B" },
  { name: "Bank Jago", color: "#FFC629" },
  { name: "SeaBank", color: "#EE4D2D" },
  { name: "Bank Neo Commerce", color: "#FF6B00" }
];

/** Default card colors for wallet types that have no external provider. */
export const TYPE_DEFAULT_COLORS: Record<string, string> = {
  cash: "#2BB673",
  credit_card: "#163E67",
  savings: "#5654A8",
  investment: "#B8860B"
};

/** Returns the provider options for a wallet type, or null when N/A. */
export function getProvidersForType(type: string): WalletProvider[] | null {
  if (type === "ewallet") {
    return EWALLET_PROVIDERS;
  }
  if (type === "bank") {
    return BANK_PROVIDERS;
  }
  return null;
}

/** Looks up a provider's brand color by name within a type. */
export function getProviderColor(type: string, name: string): string | null {
  const providers = getProvidersForType(type);
  if (!providers) {
    return null;
  }
  return providers.find((provider) => provider.name === name)?.color ?? null;
}
