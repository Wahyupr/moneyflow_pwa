export type AppAction = {
  id: string;
  label: string;
  href: string;
};

export function getDashboardQuickActions(): AppAction[] {
  return [
    { id: "manual", label: "Catat", href: "/transactions/new" },
    { id: "voice", label: "Suara", href: "/voice-input" },
    { id: "receipt", label: "Struk", href: "/scan-receipt" }

  ];
}

export function getAddActionOptions(): AppAction[] {
  return [
    { id: "voice", label: "Input Suara", href: "/voice-input" },
    { id: "manual", label: "Form Manual", href: "/transactions/new" },
    { id: "receipt", label: "Scan Struk", href: "/scan-receipt" }
  ];
}


export function maskAmount(value: string) {
  return value ? "*".repeat(value.length) : "****";
}
