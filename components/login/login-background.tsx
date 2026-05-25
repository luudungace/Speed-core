export function LoginBackground() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(120,160,220,.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(120,160,220,.05) 1px, transparent 1px)
          `,
          backgroundSize: "42px 42px",
          maskImage: "radial-gradient(ellipse at center, #000 40%, transparent 80%)",
        }}
      />

      <div className="pointer-events-none fixed inset-0 z-0 opacity-55">
        <svg className="h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          <defs>

            <linearGradient id="loginEdgeGrad" x1="0" x2="1">
              <stop offset="0%" stopColor="#00d17d" stopOpacity=".7" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity=".7" />
            </linearGradient>
          </defs>
          <path
            className="login-edge-flow"
            d="M120,180 C 320,240 420,520 640,560"
            fill="none"
            stroke="url(#loginEdgeGrad)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
          <path
            className="login-edge-flow"
            d="M640,560 C 820,580 980,300 1180,260"
            fill="none"
            stroke="url(#loginEdgeGrad)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
          <path
            className="login-edge-flow"
            d="M120,180 C 280,120 520,140 720,200"
            fill="none"
            stroke="url(#loginEdgeGrad)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
          <path
            className="login-edge-flow"
            d="M1180,260 C 1320,400 1280,640 1080,740"
            fill="none"
            stroke="url(#loginEdgeGrad)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
          <path
            className="login-edge-flow"
            d="M640,560 C 540,700 320,760 200,720"
            fill="none"
            stroke="url(#loginEdgeGrad)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
          <path
            className="login-edge-flow"
            d="M720,200 C 900,260 1020,200 1180,260"
            fill="none"
            stroke="url(#loginEdgeGrad)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
          <circle className="login-node-pulse fill-primary" cx="120" cy="180" r="4" />
          <circle className="login-node-pulse fill-cyan-400 [animation-delay:.3s]" cx="640" cy="560" r="5" />
          <circle className="login-node-pulse fill-indigo-400 [animation-delay:.7s]" cx="1180" cy="260" r="4" />
          <circle className="login-node-pulse fill-primary [animation-delay:1.1s]" cx="720" cy="200" r="3" />
          <circle className="login-node-pulse fill-cyan-400 [animation-delay:1.5s]" cx="1080" cy="740" r="4" />
          <circle className="login-node-pulse fill-indigo-400" cx="200" cy="720" r="3" />
        </svg>
      </div>

      <FloatTag className="left-[6%] top-[14%]" dotColor="#00d17d" delay="0s">
        DA 72 · forum.example.com
      </FloatTag>
      <FloatTag className="right-[8%] top-[8%]" dotColor="#22d3ee" delay="-2s">
        backlink_posted · 200 OK
      </FloatTag>
      <FloatTag className="bottom-[15%] left-[10%]" dotColor="#6366f1" delay="-4s">
        crawl_jobs · 1,284 urls
      </FloatTag>
      <FloatTag className="bottom-[10%] right-[26%]" dotColor="#f59e0b" delay="-6s">
        queue · 42 running
      </FloatTag>
      <FloatTag className="left-[30%] top-[65%] max-lg:hidden" dotColor="#00d17d" delay="-3s">
        dofollow · +318
      </FloatTag>
    </>
  );
}

function FloatTag({
  children,
  className,
  dotColor,
  delay,
}: {
  children: React.ReactNode;
  className?: string;
  dotColor: string;
  delay: string;
}) {
  return (
    <div
      className={`login-float-tag absolute z-[1] hidden rounded-md border border-border bg-panel/60 px-2.5 py-1.5 font-mono text-[11px] text-muted backdrop-blur-sm md:block ${className ?? ""}`}
      style={{ animationDelay: delay }}
    >
      <span
        className="mr-2 inline-block size-1.5 rounded-full align-middle"
        style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
      />
      {children}
    </div>
  );
}
