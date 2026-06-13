"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { maskAmount } from "@/lib/app-actions";

type PrivacyContextValue = {
  hidden: boolean;
  toggleHidden: () => void;
  displayAmount: (value: string) => string;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function PrivacyProvider({ children, defaultHidden = false }: { children: ReactNode; defaultHidden?: boolean }) {
  const [hidden, setHidden] = useState(defaultHidden);
  const value = useMemo(
    () => ({
      hidden,
      toggleHidden: () => setHidden((current) => !current),
      displayAmount: (amount: string) => (hidden ? maskAmount(amount) : amount)
    }),
    [hidden]
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  const value = useContext(PrivacyContext);

  if (!value) {
    throw new Error("usePrivacy must be used within PrivacyProvider.");
  }

  return value;
}
