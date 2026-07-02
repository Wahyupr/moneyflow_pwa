import type { LucideIcon } from "lucide-react";
import { Wallet, Mic, ReceiptText, Brain, HandCoins, Bell, FileText, MessageSquare, Sparkles } from "lucide-react";

export type PlanFeature = {
  icon: LucideIcon;
  label: string;
};

/** Highlight features unlocked at the Premium tier. */
export const PREMIUM_HIGHLIGHTS: PlanFeature[] = [
  { icon: Wallet, label: "Dompet & budget tanpa batas" },
  { icon: Mic, label: "Input suara AI tanpa batas" },
  { icon: ReceiptText, label: "Scan struk 2× sehari" },
  { icon: Brain, label: "AI Insight tanpa batas" },
  { icon: HandCoins, label: "Hutang & piutang tanpa batas" },
  { icon: Bell, label: "Pengingat tagihan tanpa batas" },
];

/** Pro includes everything in Premium, plus these. */
export const PRO_HIGHLIGHTS: PlanFeature[] = [
  { icon: MessageSquare, label: "AI Asisten Chat interaktif" },
  { icon: ReceiptText, label: "Scan struk tanpa batas" },
  { icon: FileText, label: "Semua kuota tanpa batas" },
  { icon: Wallet, label: "Dompet & budget tanpa batas" },
  { icon: Brain, label: "AI Insight tanpa batas" },
  { icon: Sparkles, label: "Prioritas fitur terbaru" },
];

export function getPlanHighlights(plan: "premium" | "pro"): PlanFeature[] {
  return plan === "pro" ? PRO_HIGHLIGHTS : PREMIUM_HIGHLIGHTS;
}
