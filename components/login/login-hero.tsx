import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SpeedCoreLogo } from "@/components/speed-core-logo";
import { cn } from "@/lib/utils";

const stats = [
  { value: "12,480", unit: "+", label: "URL Crawled" },
  { value: "47", unit: "%", label: "Success Rate" },
  { value: "3,210", unit: "+", label: "Backlinks Live" },
];

type LoginHeroProps = {
  variant?: "sidebar" | "landing";
};

export function LoginHero({ variant = "sidebar" }: LoginHeroProps) {
  const isLanding = variant === "landing";

  return (
    <section
      className={cn(
        "relative z-[2] flex flex-col justify-between",
        isLanding
          ? "mx-auto w-full max-w-4xl py-4 lg:py-8"
          : "border-b border-border px-6 py-8 lg:border-b-0 lg:border-r lg:px-24 lg:py-12",
      )}
    >
      {!isLanding && (
        <header>
          <SpeedCoreLogo size="md" subtitle="v1.0 · seo ops platform" />
        </header>
      )}

      <div className={cn("max-w-[600px]", isLanding ? "my-6 lg:my-8" : "my-10 lg:my-auto")}>
        <span className="login-kicker mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.08] px-3 py-1.5 font-mono text-[11px] text-primary">
          SEO INFRASTRUCTURE · LIVE
        </span>
        <h1 className="text-[34px] font-bold leading-[1.05] tracking-tight text-white lg:text-5xl">
          Đào{" "}
          <span className="bg-gradient-to-r from-primary via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            backlink
          </span>{" "}
          tự động ở quy mô công nghiệp.
        </h1>
        <p className="mt-4 max-w-[460px] text-base leading-relaxed text-muted">
          Crawl URL từ Google Dorks, quản lý pool email &amp; proxy, đăng ký diễn đàn và đăng bài — toàn bộ
          pipeline SEO offpage trong một dashboard duy nhất.
        </p>

        <div className="mt-9 grid max-w-[460px] grid-cols-3 gap-3.5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-panel/55 px-4 py-3.5 backdrop-blur-sm"
            >
              <div className="text-xl font-bold tracking-tight text-white lg:text-[22px]">
                {s.value}
                <span className="ml-0.5 text-sm text-primary">{s.unit}</span>
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {isLanding && (
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/login" className="login-btn inline-flex w-auto px-6 py-3">
              Vào hệ thống
              <ArrowRight size={16} strokeWidth={2.2} />
            </Link>
            <p className="text-sm text-muted">Dành cho nhân viên SEO và Team Leader nội bộ.</p>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-muted">
        <span className="login-live-dot inline-flex items-center gap-2">
          workers online · 12
        </span>
        <span>© 2026 · internal use only</span>
      </footer>
    </section>
  );
}
