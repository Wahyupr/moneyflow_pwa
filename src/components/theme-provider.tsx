"use client";

import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme
} from "next-themes";
import type { ReactNode } from "react";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

export function useTheme(): ThemeContextValue {
  const { theme, resolvedTheme, setTheme } = useNextTheme();
  const normalizedTheme = theme === "light" || theme === "dark" || theme === "system" ? theme : "system";
  const normalizedResolved = resolvedTheme === "dark" ? "dark" : "light";

  return {
    theme: normalizedTheme,
    resolvedTheme: normalizedResolved,
    setTheme: (next: Theme) => setTheme(next)
  };
}
