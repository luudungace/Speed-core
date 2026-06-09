import Link from "next/link";
import { cn } from "@/lib/utils";

type SpeedCoreLogoProps = {
  size?: "sm" | "md" | "lg" | "hero";
  subtitle?: string;
  className?: string;
  href?: string;
};

export function SpeedCoreLogo({
  size = "sm",
  subtitle,
  className,
  href,
}: SpeedCoreLogoProps) {
  const containerSizes = {
    sm: "h-[52px] w-[52px]",
    md: "h-[68px] w-[68px]",
    lg: "h-[90px] w-[90px]",
    hero: "h-[150px] w-[150px]",
  };

  const logoImgSizes = {
    sm: "h-9",
    md: "h-12",
    lg: "h-16",
    hero: "h-[95px]",
  };

  const isHero = size === "hero";

  const content = (
    <div className={cn("flex flex-col items-center justify-center w-full", className)}>
      <div className="relative">
        {/* ====== HERO decorative elements — all STATIC (no float) ====== */}
        {isHero && (
          <>
            {/* Outer rotating dashed ring */}
            <div className="absolute inset-[-20px] logo-ring-rotate pointer-events-none z-0">
              <svg viewBox="0 0 190 190" className="w-full h-full">
                <circle cx="95" cy="95" r="92" fill="none" stroke="url(#ringGrad)" strokeWidth="0.8" strokeDasharray="6 14" opacity="0.35" />
                <defs>
                  <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00F0FF" />
                    <stop offset="50%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#00F0FF" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            {/* Inner counter-rotate ring */}
            <div className="absolute inset-[-12px] logo-ring-counter-rotate pointer-events-none z-0">
              <svg viewBox="0 0 174 174" className="w-full h-full">
                <circle cx="87" cy="87" r="84" fill="none" stroke="#00F0FF" strokeWidth="0.4" strokeDasharray="3 18" opacity="0.2" />
              </svg>
            </div>
            {/* Pulsing ambient glow (behind the frame) */}
            <div className="absolute inset-[-25px] rounded-full logo-outer-glow pointer-events-none z-0" />
            {/* Orbiting dot 1 */}
            <div className="absolute inset-[-16px] logo-orbit-1 pointer-events-none z-20">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[4px] h-[4px] rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF,0_0_16px_rgba(0,240,255,0.4)]" />
            </div>
            {/* Orbiting dot 2 */}
            <div className="absolute inset-[-16px] logo-orbit-2 pointer-events-none z-20">
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-[#6366f1] shadow-[0_0_6px_#6366f1,0_0_12px_rgba(99,102,241,0.4)]" />
            </div>
            {/* Ground reflection shadow */}
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-[55%] h-[12px] rounded-full bg-[#00F0FF]/12 blur-lg logo-shadow-pulse" />
          </>
        )}

        {/* ===== STATIC circular frame — NO animation on this ===== */}
        <div className={cn(
          "logo-frame relative flex items-center justify-center rounded-full transition-shadow duration-500",
          isHero
            ? "bg-gradient-to-br from-white via-[#f8fbff] to-blue-50/85 shadow-[0_10px_35px_-6px_rgba(31,142,205,0.4),0_0_50px_rgba(0,240,255,0.08)] border-2 border-white/50"
            : "bg-white/95 shadow-lg shadow-brand-navy/10 border border-white/20 hover:shadow-brand-sky/20 hover:scale-[1.03]",
          containerSizes[size]
        )}>
          {/* Surface effects on frame (static) */}
          {isHero && (
            <>
              <div className="absolute top-[5%] left-[8%] w-[40%] h-[40%] rounded-full bg-gradient-to-br from-white/50 via-white/10 to-transparent pointer-events-none z-10" />
              <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none z-10">
                <div className="logo-shine-sweep absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[30%] rounded-b-full bg-gradient-to-t from-blue-100/20 to-transparent pointer-events-none z-10" />
            </>
          )}

          {/* ===== ANIMATED 3D infinity image — ONLY this moves ===== */}
          <img
            src="/logo.png"
            className={cn(
              "w-auto object-contain relative z-[15]",
              isHero ? "logo-infinity-3d drop-shadow-[0_3px_8px_rgba(31,142,205,0.2)]" : "",
              logoImgSizes[size]
            )}
            alt="MIC ACE Logo"
          />
        </div>
      </div>

      {subtitle && (
        <span className={cn(
          "mt-3 text-center font-mono uppercase tracking-[0.22em]",
          isHero ? "text-[10px] font-bold text-slate-400/80" : "text-[10px] font-semibold text-muted"
        )}>
          {subtitle}
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="mx-auto block transition-all duration-200">
        {content}
      </Link>
    );
  }

  return content;
}
