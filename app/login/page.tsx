import { LoginBackground } from "@/components/login/login-background";
import { LoginHero } from "@/components/login/login-hero";
import { LoginForm } from "./login-form";

export const metadata = { title: "Đăng nhập – Speed Core" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020408] text-white">
      <LoginBackground />

      <div className="relative z-[2] grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left — Hero (hidden on mobile) */}
        <div className="relative hidden lg:block">
          <LoginHero />
          {/* Vertical divider with animated glow and HUD ticks */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-[1px]">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.04] to-transparent" />
            <div className="absolute top-[20%] bottom-[20%] w-full login-divider-glow" />
            
            {/* Fine degree ticks */}
            <div className="absolute left-[-16px] top-[15%] bottom-[15%] flex flex-col justify-between items-end text-[7px] font-mono font-bold text-slate-600/50 select-none tracking-wider">
              <span>[ 90° ]</span>
              <span>[ 60° ]</span>
              <span>[ 30° ]</span>
              <span>[ 00° ]</span>
              <span>[ -30° ]</span>
              <span>[ -60° ]</span>
              <span>[ -90° ]</span>
            </div>
          </div>
        </div>

        {/* Right — Form */}
        <section className="relative z-[2] flex items-center justify-center px-6 py-12 lg:px-12 xl:px-16 min-h-screen">
          {/* Mobile-only logo */}
          <div className="absolute top-5 left-5 lg:hidden">
            <div className="flex items-center gap-2.5 rounded-full bg-white/90 pl-1.5 pr-4 py-1.5 shadow-lg backdrop-blur-md">
              <img src="/logo.png" alt="MIC ACE" className="h-8 w-8 rounded-full object-contain" />
              <span className="text-[11px] font-black text-slate-700 tracking-wide">SPEED CORE</span>
            </div>
          </div>
          <LoginForm error={params.error} />
        </section>
      </div>
    </div>
  );
}
