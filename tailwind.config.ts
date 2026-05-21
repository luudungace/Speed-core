import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#080d15",
        panel: "#111821",
        panel2: "#0d141d",
        border: "#243040",
        muted: "#9fb3cb",
        primary: "#00d17d"
      },
      fontFamily: {
        sans: ["Inter", "Arial", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"]
      }
    },
  },
  plugins: [],
};

export default config;
