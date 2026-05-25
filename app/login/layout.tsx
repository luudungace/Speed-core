import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "vietnamese"],
  variable: "--font-login-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-login-mono",
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${spaceGrotesk.className} min-h-screen`}
      style={{ fontFamily: "var(--font-login-sans), system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}
