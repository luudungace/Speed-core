import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#050911",
        panel: "#0b1220",
        panel2: "#080d17",
        border: "#1b283d",
        muted: "#8c9fb8",
        primary: "#1f8ecd",
        "brand-navy": "#1a4894",
        "brand-royal": "#1355a2",
        "brand-sky": "#1f8ecd",
        "brand-accent": "#117ec2"
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
