"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Database,
  FileText,
  ListChecks,
  LogOut,
  PanelsTopLeft,
  Search,
  ShieldCheck,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/login/logout-action";
import { SpeedCoreLogo } from "@/components/speed-core-logo";

const navItems = [
  { href: "/", label: "Tổng quan", icon: PanelsTopLeft },
  { href: "/crawler-url", label: "Crawler URL", icon: Search },
  { href: "/resources", label: "Tài nguyên", icon: Database },
  { href: "/register-forum", label: "Đăng ký diễn đàn", icon: ListChecks },
  { href: "/direct-posting", label: "Đăng bài trực tiếp", icon: Send },
  { href: "/registered-forums", label: "Diễn đàn đã đăng ký", icon: ShieldCheck },
  { href: "/posted-backlinks", label: "Backlink đã đăng", icon: FileText },
];

export function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#020408] text-white">
      {/* Floating Glassmorphic Sidebar */}
      <aside className="fixed bottom-4 left-4 top-4 z-20 w-[260px] rounded-2xl flex flex-col justify-between overflow-hidden border border-white/[0.04] bg-[#050811]/70 backdrop-blur-xl shadow-2xl">
        {/* Ambient sidebar background glows */}
        <div className="pointer-events-none absolute -top-12 -left-12 h-32 w-32 nebula-glow-blue opacity-30 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-40 w-40 nebula-glow-violet opacity-20 blur-2xl" />

        <div className="relative z-10">
          <div className="flex py-6 px-4 items-center justify-center border-b border-white/[0.05] bg-white/[0.01] relative">
            <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-brand-sky/20 to-transparent" />
            <SpeedCoreLogo size="sm" subtitle="Khối Crypto Media" href="/" />
          </div>
          <div className="px-3.5 pt-6">
            <div className="mb-4 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-sky/70">
              VẬN HÀNH HỆ THỐNG
            </div>
            <nav className="space-y-2">
              {navItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold tracking-wide transition-all duration-300",
                      active 
                        ? "bg-gradient-to-r from-brand-sky/15 to-transparent text-white border-l-2 border-brand-sky pl-5 shadow-[inset_1px_0_0_rgba(255,255,255,0.05)]" 
                        : "text-slate-300 hover:bg-white/[0.03] hover:text-white pl-3 hover:translate-x-1",
                    )}
                  >
                    <Icon 
                      size={16} 
                      className={cn(
                        "transition-all duration-300", 
                        active ? "text-brand-sky drop-shadow-[0_0_6px_#00F0FF]" : "text-slate-400"
                      )} 
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer with system health indicator & Admin Card */}
        <div className="relative z-10">
          {/* Telemetry Systems Monitor Widget */}
          <div className="mx-3.5 my-3 rounded-xl border border-white/[0.04] bg-white/[0.01] p-3.5 backdrop-blur-sm relative overflow-hidden group hover:border-brand-sky/20 transition-all duration-300">
            {/* Micro grid pattern background */}
            <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:8px_8px]" />
            
            <div className="relative z-10 flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full pulse-glow-cyan" />
                <span className="text-[10px] font-mono font-black tracking-wider text-slate-300 group-hover:text-brand-sky transition-colors">SYS MONITOR</span>
              </div>
              <span className="text-[10px] font-mono font-black text-brand-sky">v1.2</span>
            </div>

            {/* Telemetry info row */}
            <div className="relative z-10 grid grid-cols-2 gap-1.5 text-[9px] font-mono font-bold text-slate-400">
              <div className="flex items-center gap-1 bg-white/[0.02] px-1.5 py-0.5 rounded border border-white/[0.02]">
                <span className="text-brand-sky">STATUS:</span>
                <span className="text-emerald-400 animate-pulse">LIVE</span>
              </div>
              <div className="flex items-center gap-1 bg-white/[0.02] px-1.5 py-0.5 rounded border border-white/[0.02]">
                <span className="text-brand-sky">PING:</span>
                <span className="text-slate-300">14ms</span>
              </div>
            </div>
          </div>

          {/* Premium Admin Profile card & Logout */}
          <div className="border-t border-white/[0.05] p-3.5 bg-white/[0.01] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-brand-sky to-brand-navy flex items-center justify-center text-xs font-black text-white shadow-md shadow-brand-sky/10 border border-white/10">
                A
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-white leading-none">ADMINISTRATOR</span>
                <span className="text-[9px] font-bold text-brand-sky mt-1 uppercase tracking-wider">Crypto Media</span>
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                title="Đăng xuất"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.04] bg-white/[0.02] text-slate-400 transition-all duration-300 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/25"
              >
                <LogOut size={14} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="min-h-screen min-w-0 pl-[292px] pr-4 py-4">
        <header className="flex h-14 items-center justify-between rounded-xl glass-card border border-white/[0.03] px-5 text-sm text-muted mb-4 shadow-lg">
          <div className="flex items-center gap-2 font-bold">
            <Activity size={16} className="text-brand-sky" />
            <span className="text-white tracking-wide">Tổng quan vận hành</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono font-bold">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>DB CONNECTED</span>
            </div>
          </div>
        </header>
        <div className="min-w-0">{children}</div>
      </main>
    </div>
  );
}
