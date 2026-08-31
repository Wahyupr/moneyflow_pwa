/**
 * Master data for Indonesian wallet providers (e-wallets & banks) plus their
 * brand colors and logo badges. Used by the wallet form so an admin/user picks
 * a provider from a dropdown instead of typing a name, and the wallet card
 * color + logo is set automatically from the provider's brand data.
 *
 * `institution_name` on the wallet stores the chosen provider's name.
 */

export type WalletProvider = {
  /** Provider name stored in wallets.institution_name. */
  name: string;
  /** Brand color used as the wallet card gradient start (hex). */
  color: string;
  /** Secondary gradient color (hex). Defaults to darkened color if omitted. */
  colorEnd?: string;
  /** Short abbreviation shown on the logo badge (max 4 chars). */
  abbr: string;
  /** Badge background color (hex). */
  badgeBg: string;
  /** Badge text color (hex). */
  badgeText: string;
  /**
   * Brand wordmark rendered on the logo chip (e.g. "gopay", "DANA"). Falls back
   * to `name` when omitted. This makes the chip read like the real brand logo
   * instead of a plain abbreviation.
   */
  wordmark?: string;
  /** Casing style applied to the wordmark on the chip. */
  wordmarkCase?: "lower" | "upper" | "normal";
  /** Wordmark text color on the (white) logo chip (hex). Defaults to `color`. */
  logoText?: string;
};

/** Popular Indonesian e-wallets. */
export const EWALLET_PROVIDERS: WalletProvider[] = [
  { name: "GoPay",      color: "#00AED6", colorEnd: "#007A99", abbr: "GP",   badgeBg: "#00AED6", badgeText: "#fff", wordmark: "gopay",     wordmarkCase: "lower", logoText: "#0098CE" },
  { name: "OVO",        color: "#4C2A86", colorEnd: "#2D1852", abbr: "OVO",  badgeBg: "#4C2A86", badgeText: "#fff", wordmark: "OVO",       wordmarkCase: "upper", logoText: "#4C2A86" },
  { name: "DANA",       color: "#108EE9", colorEnd: "#0A65A8", abbr: "DANA", badgeBg: "#108EE9", badgeText: "#fff", wordmark: "DANA",      wordmarkCase: "upper", logoText: "#108EE9" },
  { name: "ShopeePay",  color: "#EE4D2D", colorEnd: "#B33520", abbr: "SPay", badgeBg: "#EE4D2D", badgeText: "#fff", wordmark: "ShopeePay", wordmarkCase: "normal", logoText: "#EE4D2D" },
  { name: "LinkAja",    color: "#E82127", colorEnd: "#A8181D", abbr: "LA",   badgeBg: "#E82127", badgeText: "#fff", wordmark: "LinkAja",   wordmarkCase: "normal", logoText: "#E82127" },
  { name: "Sakuku",     color: "#005BAC", colorEnd: "#003D79", abbr: "SKK",  badgeBg: "#005BAC", badgeText: "#fff", wordmark: "Sakuku",    wordmarkCase: "normal", logoText: "#005BAC" },
  { name: "i.saku",     color: "#E4002B", colorEnd: "#A8001F", abbr: "iS",   badgeBg: "#E4002B", badgeText: "#fff", wordmark: "i.saku",    wordmarkCase: "lower", logoText: "#E4002B" },
  { name: "Jenius Pay", color: "#00B2A9", colorEnd: "#007A73", abbr: "JPay", badgeBg: "#00B2A9", badgeText: "#fff", wordmark: "Jenius",    wordmarkCase: "normal", logoText: "#00B2A9" },
  { name: "Flip",       color: "#F36D00", colorEnd: "#B34F00", abbr: "FLIP", badgeBg: "#F36D00", badgeText: "#fff", wordmark: "Flip",      wordmarkCase: "normal", logoText: "#F36D00" },
];

/** Common Indonesian banks. */
export const BANK_PROVIDERS: WalletProvider[] = [
  { name: "BCA",               color: "#005BAC", colorEnd: "#003D79", abbr: "BCA",  badgeBg: "#005BAC", badgeText: "#fff", wordmark: "BCA",    wordmarkCase: "upper",  logoText: "#005BAC" },
  { name: "Bank Mandiri",      color: "#003D79", colorEnd: "#001E40", abbr: "MDR",  badgeBg: "#003D79", badgeText: "#FFD700", wordmark: "mandiri", wordmarkCase: "lower", logoText: "#003D79" },
  { name: "BRI",               color: "#003F8A", colorEnd: "#001E45", abbr: "BRI",  badgeBg: "#003F8A", badgeText: "#F5A623", wordmark: "BRI",    wordmarkCase: "upper",  logoText: "#003F8A" },
  { name: "BNI",               color: "#F15A22", colorEnd: "#B03E14", abbr: "BNI",  badgeBg: "#F15A22", badgeText: "#fff", wordmark: "BNI",    wordmarkCase: "upper",  logoText: "#005B98" },
  { name: "BSI",               color: "#00A39D", colorEnd: "#006B67", abbr: "BSI",  badgeBg: "#00A39D", badgeText: "#fff", wordmark: "BSI",    wordmarkCase: "upper",  logoText: "#00A39D" },
  { name: "CIMB Niaga",        color: "#7A0019", colorEnd: "#4A000F", abbr: "CIMB", badgeBg: "#7A0019", badgeText: "#fff", wordmark: "CIMB",   wordmarkCase: "upper",  logoText: "#7A0019" },
  { name: "Bank Danamon",      color: "#005CAB", colorEnd: "#003A6E", abbr: "DNM",  badgeBg: "#005CAB", badgeText: "#fff", wordmark: "Danamon", wordmarkCase: "normal", logoText: "#005CAB" },
  { name: "Permata Bank",      color: "#005EB8", colorEnd: "#003D79", abbr: "PMT",  badgeBg: "#005EB8", badgeText: "#fff", wordmark: "Permata", wordmarkCase: "normal", logoText: "#005EB8" },
  { name: "Bank BTN",          color: "#00529B", colorEnd: "#003366", abbr: "BTN",  badgeBg: "#00529B", badgeText: "#F5C518", wordmark: "BTN",   wordmarkCase: "upper",  logoText: "#00529B" },
  { name: "Bank Jago",         color: "#3AB54A", colorEnd: "#1E7A2A", abbr: "JAGO", badgeBg: "#3AB54A", badgeText: "#fff", wordmark: "Jago",   wordmarkCase: "normal", logoText: "#1E7A2A" },
  { name: "SeaBank",           color: "#EE4D2D", colorEnd: "#B33520", abbr: "SEA",  badgeBg: "#EE4D2D", badgeText: "#fff", wordmark: "SeaBank", wordmarkCase: "normal", logoText: "#EE4D2D" },
  { name: "Bank Neo Commerce", color: "#FF6B00", colorEnd: "#B34B00", abbr: "BNC",  badgeBg: "#FF6B00", badgeText: "#fff", wordmark: "neo",    wordmarkCase: "lower",  logoText: "#FF6B00" },
  { name: "Allo Bank",         color: "#0057A8", colorEnd: "#003A70", abbr: "ALLO", badgeBg: "#0057A8", badgeText: "#FFC107", wordmark: "allo", wordmarkCase: "lower",  logoText: "#0057A8" },
  { name: "Bank Syariah Indonesia (BSB)", color: "#00A39D", colorEnd: "#006B67", abbr: "BSB", badgeBg: "#00A39D", badgeText: "#fff", wordmark: "BSI", wordmarkCase: "upper", logoText: "#00A39D" },
  { name: "OCBC NISP",         color: "#D0021B", colorEnd: "#8A0012", abbr: "OCBC", badgeBg: "#D0021B", badgeText: "#fff", wordmark: "OCBC",   wordmarkCase: "upper",  logoText: "#D0021B" },
  { name: "Maybank",           color: "#F7A600", colorEnd: "#B37800", abbr: "MBK",  badgeBg: "#F7A600", badgeText: "#fff", wordmark: "Maybank", wordmarkCase: "normal", logoText: "#F7A600" },
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

/** Looks up a provider by name within a type. */
export function getProvider(type: string, name: string): WalletProvider | null {
  const providers = getProvidersForType(type);
  if (!providers) return null;
  return providers.find((p) => p.name === name) ?? null;
}

/** Looks up a provider's brand color by name within a type. */
export function getProviderColor(type: string, name: string): string | null {
  return getProvider(type, name)?.color ?? null;
}

/** Resolved logo presentation for rendering a brand chip. */
export type ProviderLogo = {
  /** Text shown on the chip, already cased per the provider's style. */
  text: string;
  /** Wordmark text color (hex). */
  textColor: string;
};

/**
 * Builds the display text + color for a provider's logo chip. Applies the
 * provider's casing style and falls back to the abbreviation when no wordmark
 * is defined. Returns null when the provider is unknown.
 */
export function getProviderLogo(type: string, name: string): ProviderLogo | null {
  const provider = getProvider(type, name);
  if (!provider) return null;

  const raw = provider.wordmark ?? provider.abbr;
  const text =
    provider.wordmarkCase === "lower"
      ? raw.toLowerCase()
      : provider.wordmarkCase === "upper"
        ? raw.toUpperCase()
        : raw;

  return { text, textColor: provider.logoText ?? provider.color };
}
