"use client";

import { useEffect, useState, useRef } from "react";
import { SpeedCoreLogo } from "@/components/speed-core-logo";
import { TrendingUp, Globe, Zap, Wifi, Terminal } from "lucide-react";

const stats = [
  { value: "12,480", unit: "+", label: "URL Crawled", icon: Globe, color: "#00F0FF" },
  { value: "47", unit: "%", label: "Success Rate", icon: TrendingUp, color: "#6366f1" },
  { value: "3,210", unit: "+", label: "Backlinks Live", icon: Zap, color: "#22d3ee" },
];

const LOG_MESSAGES = [
  "SYSTEM: Initializing crawler engines...",
  "DORKER: Importing Google Dork lists (48k targets)...",
  "PROXY: Fetching live proxy lists from pool...",
  "PROXY: Verification complete. 842 proxies active.",
  "CRAWLER: Querying Google for XenForo forum boards...",
  "CRAWLER: Discovered 148 boards. Injecting to queue...",
  "REGISTRATION: flatboard.example.com -> bypass cookie banner",
  "REGISTRATION: flatboard.example.com -> resolving captcha...",
  "REGISTRATION: flatboard.example.com -> registered successfully.",
  "EMAIL: IMAP trigger detected for confirmation email...",
  "EMAIL: Verification code extracted: 481-902",
  "REGISTRATION: flatboard.example.com -> verified & live.",
  "POSTER: flatboard.example.com -> publishing link payload...",
  "POSTER: flatboard.example.com -> backlink published (DA: 42).",
  "DORKER: Querying 'site:*.edu \"powered by phpbb\"'...",
  "REGISTRATION: wordpress.example.org -> profile created.",
  "SYSTEM: Synced 4.8k active backlinks to live database.",
];

export function LoginHero() {
  const [logs, setLogs] = useState<string[]>([
    "SYSTEM: Core online. Ready for task execution.",
    "PROXY: Latency test passed. Avg delay 42ms.",
    "CRAWLER: Scanning active dork queue...",
  ]);
  const logIndexRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogs((prev) => {
        const nextLog = LOG_MESSAGES[logIndexRef.current];
        logIndexRef.current = (logIndexRef.current + 1) % LOG_MESSAGES.length;
        const updated = [...prev, nextLog];
        if (updated.length > 5) {
          updated.shift();
        }
        return updated;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative z-[2] flex flex-col h-screen px-8 py-10 lg:px-14 xl:px-20 overflow-hidden">
      
      {/* ──── COSMIC RADAR BACKGROUND OVERLAYS ──── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0 opacity-[0.22]">
        {/* Radar concentric rings (centered behind logo area) */}
        <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full border border-[#00F0FF]/[0.08] flex items-center justify-center animate-[spin_120s_linear_infinite]">
          <div className="w-[400px] h-[400px] rounded-full border border-dashed border-[#00F0FF]/[0.04] flex items-center justify-center">
            <div className="w-[300px] h-[300px] rounded-full border border-[#00F0FF]/[0.08] flex items-center justify-center">
              <div className="w-[200px] h-[200px] rounded-full border border-dashed border-[#6366f1]/[0.05]" />
            </div>
          </div>
        </div>
        {/* Crosshair coordinate lines */}
        <div className="absolute top-[150px] left-[40px] w-[220px] h-[1px] bg-gradient-to-r from-transparent via-[#00F0FF]/25 to-transparent" />
        <div className="absolute top-[40px] left-[150px] w-[1px] h-[220px] bg-gradient-to-b from-transparent via-[#00F0FF]/25 to-transparent" />
      </div>

      {/* ──── TOP: Logo + Brand + Coordinate Telemetry ──── */}
      <header className="login-hero-fade-in flex-shrink-0 flex items-start justify-between relative z-10" style={{ animationDelay: "0.1s" }}>
        <SpeedCoreLogo size="hero" subtitle="speed core · v1.0" />
        
        {/* Space telemetry coordinates */}
        <div className="flex flex-col items-end font-mono text-[9px] font-bold text-slate-500/60 uppercase tracking-[0.18em] max-xl:hidden pt-3">
          <span className="text-[#00F0FF]/60">COORD: RA 18H 36M / DEC +38°</span>
          <span>CELESTIAL CORE: ACTIVE</span>
          <span>SECTOR: ORBITAL_9</span>
        </div>
      </header>

      {/* ──── MIDDLE: Main content — grows to fill space ──── */}
      <div className="flex-1 flex flex-col justify-center max-w-[540px] py-6 relative z-10">
        {/* Status badge */}
        <div className="login-hero-fade-in" style={{ animationDelay: "0.35s" }}>
          <span className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-[#00F0FF]/25 bg-[#00F0FF]/[0.04] px-4 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.15em] text-[#00F0FF]/90 backdrop-blur-sm">
            <span className="relative flex h-[6px] w-[6px]">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00F0FF] opacity-60" />
              <span className="relative inline-flex rounded-full h-[6px] w-[6px] bg-[#00F0FF]" />
            </span>
            SEO Celestial Core · Online
          </span>
        </div>

        {/* Headline */}
        <div className="login-hero-fade-in" style={{ animationDelay: "0.5s" }}>
          <h1 className="text-[32px] font-black leading-[1.1] tracking-tight text-white lg:text-[42px] xl:text-[46px]">
            Đào{" "}
            <span className="login-gradient-text">backlink</span>{" "}
            tự động
            <br />
            <span className="text-white/50 font-extrabold">ở quy mô công nghiệp.</span>
          </h1>
        </div>

        {/* Description */}
        <div className="login-hero-fade-in" style={{ animationDelay: "0.65s" }}>
          <p className="mt-4 max-w-[440px] text-[13px] font-medium leading-[1.7] text-slate-400/90">
            Crawl URL từ Google Dorks, quản lý pool email &amp; proxy, 
            đăng ký diễn đàn và đăng bài — toàn bộ pipeline SEO offpage 
            trong một dashboard duy nhất.
          </p>
        </div>

        {/* Futuristic Scrolling HUD Terminal (Replaced blocky capability grid) */}
        <div className="login-hero-fade-in mt-7" style={{ animationDelay: "0.8s" }}>
          <div className="relative rounded-2xl border border-[#00F0FF]/15 bg-[#050811]/90 p-4 font-mono shadow-[0_0_30px_rgba(0,240,255,0.03)] overflow-hidden">
            {/* Scanline overlay */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-40 z-10" />
            
            {/* Terminal Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Terminal size={10} className="text-[#00F0FF]" />
                TELEMETRY_STREAM_LOG
              </span>
              <span className="flex h-2 w-2 rounded-full bg-[#00F0FF] animate-pulse" />
            </div>

            {/* Scrollable logs */}
            <div className="space-y-1.5 text-[9px] min-h-[110px] flex flex-col justify-end">
              {logs.map((log, idx) => {
                const isSystem = log.startsWith("SYSTEM");
                const isError = log.includes("ERROR") || log.includes("fail");
                const isSuccess = log.includes("success") || log.includes("live") || log.includes("complete") || log.includes("verified");
                
                let textColor = "text-slate-400";
                if (isSystem) textColor = "text-[#6366f1]/90 font-bold";
                else if (isSuccess) textColor = "text-emerald-400 font-bold";
                else if (isError) textColor = "text-red-400 font-bold";
                else if (log.startsWith("CRAWLER") || log.startsWith("PROXY") || log.startsWith("DORKER")) textColor = "text-[#00F0FF]";

                return (
                  <div key={idx} className={`${textColor} leading-normal flex items-start gap-1.5 transition-all duration-300`}>
                    <span className="text-slate-600 shrink-0 select-none">&gt;&gt;</span>
                    <span className="break-all">{log}</span>
                  </div>
                );
              })}
            </div>

            {/* Cybernetic terminal details */}
            <div className="absolute bottom-1 right-2 text-[7px] text-slate-700/80 font-bold tracking-wider uppercase select-none">
              SPEED_CORE_V1.0 // CELESTIAL_LINK_SYS
            </div>
          </div>
        </div>

        {/* Stats row with HUD corner highlights */}
        <div className="login-hero-fade-in mt-6 grid grid-cols-3 gap-2.5" style={{ animationDelay: "0.95s" }}>
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="group relative overflow-hidden rounded-xl border border-white/[0.04] bg-white/[0.01] px-3.5 py-3.5 backdrop-blur-md transition-all duration-300 hover:border-[#00F0FF]/15 hover:bg-white/[0.03] hover:-translate-y-0.5"
              >
                {/* Tech corner accent in stats */}
                <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-[#00F0FF]/30 rounded-tl-sm pointer-events-none group-hover:border-[#00F0FF]/60 transition-colors" />
                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-[#00F0FF]/30 rounded-br-sm pointer-events-none group-hover:border-[#00F0FF]/60 transition-colors" />

                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-[#00F0FF]/[0.03] to-transparent" />
                <div className="relative z-10 flex items-center justify-between">
                  <div className="text-[20px] font-black tracking-tight text-white">
                    {s.value}
                    <span className="ml-0.5 text-[11px] font-black" style={{ color: s.color }}>{s.unit}</span>
                  </div>
                  <Icon size={13} className="text-slate-600 group-hover:text-[#00F0FF]/70 transition-colors duration-300" />
                </div>
                <div className="relative z-10 mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500/80">
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ──── BOTTOM: Footer ──── */}
      <footer className="login-hero-fade-in flex-shrink-0 flex items-center justify-between gap-4 pt-4 border-t border-white/[0.04] relative z-10" style={{ animationDelay: "1.1s" }}>
        <span className="inline-flex items-center gap-2 font-mono text-[9px] font-bold text-slate-500/70 uppercase tracking-wider">
          <Wifi size={10} className="text-emerald-400" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,.5)] animate-pulse" />
          12 workers online
        </span>
        <span className="font-mono text-[9px] font-bold text-slate-600/50 uppercase tracking-wider">
          © 2026 MIC ACE
        </span>
      </footer>
    </section>
  );
}
