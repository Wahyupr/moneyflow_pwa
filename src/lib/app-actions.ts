export type AppAction = {
  id: string;
  label: string;
  href: string;
};

export function getDashboardQuickActions(): AppAction[] {
  return [
    { id: "manual", label: "Catat", href: "/transactions/new" },
    { id: "voice", label: "Suara", href: "/voice-input" },
    { id: "receipt", label: "Struk", href: "/ai-transaction-review?source=receipt" }
  ];
}

export function getAddActionOptions(): AppAction[] {
  return [
    { id: "voice", label: "Input Suara", href: "/voice-input" },
    { id: "manual", label: "Form Manual", href: "/transactions/new" },
    { id: "receipt", label: "Scan Struk", href: "/ai-transaction-review?source=receipt" },
    { id: "transfer_proof", label: "Bukti Transfer", href: "/ai-transaction-review?source=transfer_proof" },
    { id: "qris", label: "Screenshot QRIS", href: "/ai-transaction-review?source=qris" },
    { id: "ai_review", label: "Review Draft AI", href: "/ai-transaction-review" }
  ];
}

export function maskAmount(value: string) {
  return value ? "*".repeat(value.length) : "****";
}
