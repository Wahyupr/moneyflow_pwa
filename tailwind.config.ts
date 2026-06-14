import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#f8f9ff",
        ink: "#0b1c30",
        muted: "#3d4250",
        outline: "#c0c9da",
        surface: "#ffffff",
        "surface-low": "#eff4ff",
        "surface-container": "#e5eeff",
        "surface-highest": "#d3e4fe",
        primary: "#1668DC",
        "primary-container": "#3B9EFF",
        secondary: "#3B9EFF",
        tertiary: "#0A3B8C",

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
