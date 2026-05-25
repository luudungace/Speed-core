import { SpeedCoreLogo } from "@/components/speed-core-logo";

const stats = [
  { value: "12,480", unit: "+", label: "URL Crawled" },
  { value: "47", unit: "%", label: "Success Rate" },
  { value: "3,210", unit: "+", label: "Backlinks Live" },
];

export function LoginHero() {
  return (
    <section className="relative z-[2] flex flex-col justify-between border-b border-border px-6 py-8 lg:border-b-0 lg:border-r lg:px-24 lg:py-12">
      <header>
        <SpeedCoreLogo size="md" subtitle="v1.0 · seo ops platform" />
      </header>

      <div className="my-10 max-w-[600px] lg:my-auto">
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
