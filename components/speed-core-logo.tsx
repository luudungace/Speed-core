import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Brand mark: hub trung tâm + vòng quỹ đạo + chữ S (speed) + node backlink.
 * Phù hợp console SEO: crawl → kết nối → đăng bài.
 */
const sizeConfig = {
  sm: { icon: 36, title: "text-[17px]", sub: "text-[11px]" },
  md: { icon: 44, title: "text-[22px]", sub: "text-[11px]" },
  lg: { icon: 54, title: "text-[28px]", sub: "text-[12px]" },
} as const;

type SpeedCoreLogoProps = {
  size?: keyof typeof sizeConfig;
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
  const cfg = sizeConfig[size];
  const mark = (
    <div className={cn("inline-flex items-center gap-3", className)} aria-label="Speed Core">
      <SpeedCoreMark size={cfg.icon} />
      <div className="flex min-w-0 flex-col justify-center leading-none">
        <div className={cn("flex items-baseline gap-1.5 font-bold tracking-tight", cfg.title)}>
          <span className="text-white">Speed</span>
          <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
            Core
          </span>
        </div>
        {subtitle && (
          <span
            className={cn(
              "mt-1.5 font-mono uppercase tracking-[0.14em] text-muted",
              cfg.sub,
            )}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex rounded-lg transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60"
      >
        {mark}
      </Link>
    );
  }

  return mark;
}

function SpeedCoreMark({ size }: { size: number }) {
  const rawId = useId().replace(/:/g, "");
  const bg = `${rawId}-bg`;
  const ring = `${rawId}-ring`;
  const sGrad = `${rawId}-s`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id={ring} x1="8" y1="6" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00d17d" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={bg} x1="20" y1="4" x2="20" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#121c2a" />
          <stop offset="1" stopColor="#060b13" />
        </linearGradient>
        <linearGradient id={sGrad} x1="14" y1="12" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00d17d" />
          <stop offset="1" stopColor="#5eead4" />
        </linearGradient>
      </defs>

      {/* Khung — góc bo, cảm giác SaaS console */}
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="10"
        fill={`url(#${bg})`}
        stroke={`url(#${ring})`}
        strokeWidth="1.6"
      />

      {/* Vòng quỹ đạo crawl / pipeline */}
      <path
        d="M29 11.5A15 15 0 0 0 11 27"
        stroke="#00d17d"
        strokeOpacity="0.28"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeDasharray="3 4"
        fill="none"
      />

      {/* Liên kết backlink: hub → node */}
      <path
        d="M20 21 L29 11.5 M20 21 L11 27 M20 21 L30.5 29"
        stroke="#00d17d"
        strokeOpacity="0.38"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* Node backlink */}
      <circle cx="29" cy="11.5" r="2.1" fill="#00d17d" />
      <circle cx="11" cy="27" r="2.1" fill="#22d3ee" fillOpacity="0.9" />
      <circle cx="30.5" cy="29" r="1.6" fill="#00d17d" fillOpacity="0.55" />

      {/* Hub trung tâm — "Core" */}
      <circle cx="20" cy="21" r="2.4" fill="#00d17d" fillOpacity="0.25" />
      <circle cx="20" cy="21" r="1.2" fill="#00d17d" />

      {/* Monogram S — tốc độ (nét cong dứt khoát) */}
      <path
        d="M25.2 13.8c-4.8-1.8-9.2 0.2-9.2 4.2c0 3.2 3.8 4 8.2 5c4.4 1 8.2 1.8 8.2 5.4c0 3.8-4.6 6.2-10.2 4.4"
        stroke={`url(#${sGrad})`}
        strokeWidth="2.65"
        strokeLinecap="round"
        fill="none"
      />

      {/* Mũi tên speed — hướng xử lý / throughput */}
      <path
        d="M26.2 12.8 L29.8 10.6 M29.8 10.6 L28.8 14.2"
        stroke="#22d3ee"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
