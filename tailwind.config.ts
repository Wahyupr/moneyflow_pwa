import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#f8f9ff",
        ink: "#0b1c30",
        muted: "#3d4a42",
        outline: "#bccac0",
        surface: "#ffffff",
        "surface-low": "#eff4ff",
        "surface-container": "#e5eeff",
        "surface-highest": "#d3e4fe",
        primary: "#006948",
        "primary-container": "#00855d",
        secondary: "#5654a8",
        tertiary: "#9b3e3b",
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
      }
    }
  },
  plugins: []
};

export default config;
