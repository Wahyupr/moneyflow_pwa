/**
 * Curated set of category icons shared by the admin master-category form and
 * the user personal-category form. Keeping the list in one place ensures both
 * surfaces present the same vocabulary and prevents drift in icon labels.
 */

import {
  Banknote,
  Bus,
  Car,
  Coffee,
  CreditCard,
  Gift,
  GraduationCap,
  Heart,
  Home,
  PiggyBank,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Utensils,
  Wallet,
  Wrench,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type CategoryIconOption = {
  /** Stable identifier persisted on categories.icon (kebab-case). */
  value: string;
  /** Indonesian label shown in the picker. */
  label: string;
  /** Lucide icon component rendered for this option. */
  Icon: LucideIcon;
};

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  { value: "tag", label: "Umum", Icon: Tag },
  { value: "utensils", label: "Makan", Icon: Utensils },
  { value: "coffee", label: "Kopi", Icon: Coffee },
  { value: "shopping-cart", label: "Belanja", Icon: ShoppingCart },
  { value: "shopping-bag", label: "Tas Belanja", Icon: ShoppingBag },
  { value: "car", label: "Mobil", Icon: Car },
  { value: "bus", label: "Transport", Icon: Bus },
  { value: "plane", label: "Travel", Icon: Plane },
  { value: "home", label: "Rumah", Icon: Home },
  { value: "zap", label: "Listrik", Icon: Zap },
  { value: "smartphone", label: "Pulsa", Icon: Smartphone },
  { value: "receipt", label: "Tagihan", Icon: Receipt },
  { value: "heart", label: "Kesehatan", Icon: Heart },
  { value: "graduation-cap", label: "Pendidikan", Icon: GraduationCap },
  { value: "gift", label: "Hadiah", Icon: Gift },
  { value: "sparkles", label: "Hiburan", Icon: Sparkles },
  { value: "wrench", label: "Perbaikan", Icon: Wrench },
  { value: "banknote", label: "Gaji", Icon: Banknote },
  { value: "wallet", label: "Dompet", Icon: Wallet },
  { value: "piggy-bank", label: "Tabungan", Icon: PiggyBank },
  { value: "credit-card", label: "Kartu", Icon: CreditCard }
];

const ICON_BY_VALUE = new Map(CATEGORY_ICON_OPTIONS.map((option) => [option.value, option.Icon]));

/** Fallback icon when a stored value does not match any curated option. */
export const DEFAULT_CATEGORY_ICON = Tag;

/** Default icon value used when the user submits without picking one. */
export const DEFAULT_CATEGORY_ICON_VALUE = "tag";

/** Resolves a stored icon string to a renderable Lucide component. */
export function getCategoryIcon(value: string | null | undefined): LucideIcon {
  if (value && ICON_BY_VALUE.has(value)) {
    return ICON_BY_VALUE.get(value)!;
  }
  return DEFAULT_CATEGORY_ICON;
}

/** Human-readable label for a stored icon value. */
export function getCategoryIconLabel(value: string | null | undefined): string {
  return CATEGORY_ICON_OPTIONS.find((option) => option.value === value)?.label ?? "Umum";
}
