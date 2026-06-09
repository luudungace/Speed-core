import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#03060a",
        panel: "rgba(8, 14, 23, 0.7)",
        panel2: "rgba(5, 8, 12, 0.85)",
        border: "rgba(0, 209, 125, 0.15)",
        muted: "#9fb3cb",
        primary: "#00d17d",
        secondary: "#34d399",
      },
      fontFamily: {
        sans: ["Outfit", "Inter", "Arial", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"]
      }
    },
  },
  plugins: [],
};

export default config;
