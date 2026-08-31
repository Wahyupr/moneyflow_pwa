import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        outline: "var(--color-outline)",
        surface: "var(--color-surface)",
        "surface-low": "var(--color-surface-low)",
        "surface-container": "var(--color-surface-container)",
        "surface-highest": "var(--color-surface-highest)",
        primary: "var(--color-primary)",
        "primary-container": "var(--color-primary-container)",
        secondary: "var(--color-secondary)",
        tertiary: "var(--color-tertiary)",

        income: "#10B981",
        expense: "#EF4444",
        transfer: "#6366F1",
        warning: "#F59E0B",
        privacy: "#E2E8F0"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      // Slightly smaller global type scale (~10-12% down from Tailwind defaults)
      // so long words/labels wrap or fit instead of truncating or overlapping.
      // Line-heights stay comfortable to keep 2-line text readable.
      fontSize: {
        xs: ["0.6875rem", { lineHeight: "0.95rem" }], // 11px
        sm: ["0.8125rem", { lineHeight: "1.15rem" }], // 13px
        base: ["0.9375rem", { lineHeight: "1.4rem" }], // 15px
        lg: ["1rem", { lineHeight: "1.5rem" }], // 16px
        xl: ["1.125rem", { lineHeight: "1.6rem" }], // 18px
        "2xl": ["1.375rem", { lineHeight: "1.8rem" }], // 22px
        "3xl": ["1.6875rem", { lineHeight: "2.05rem" }], // 27px
        "4xl": ["2rem", { lineHeight: "2.25rem" }], // 32px
        "5xl": ["2.625rem", { lineHeight: "1" }], // 42px
        "6xl": ["3.25rem", { lineHeight: "1" }] // 52px
      },
      boxShadow: {
        card: "0 4px 20px rgb(0 0 0 / 0.05)",
        lift: "0 10px 28px rgb(11 28 48 / 0.10)"
      },
      keyframes: {
        "sheet-up": {
          from: { transform: "translateY(100%)", opacity: "0.6" },
          to: { transform: "translateY(0)", opacity: "1" }
        }
      },
      animation: {
        "sheet-up": "sheet-up 0.28s cubic-bezier(0.22, 1, 0.36, 1)"
      }
    }
  },

  plugins: []
};

export default config;
