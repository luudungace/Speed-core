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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/login/logout-action";
import { SpeedCoreLogo } from "@/components/speed-core-logo";

const navItems = [
  { href: "/", label: "Tổng quan", icon: PanelsTopLeft },
  { href: "/crawler-url", label: "Crawler URL", icon: Search },
  { href: "/resources", label: "Tài nguyên", icon: Database },
  { href: "/register-forum", label: "Đăng ký diễn đàn", icon: ListChecks },
  { href: "/posted-backlinks", label: "Backlink đã đăng", icon: FileText },
];

export function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname();

  return (
    <div 
      className="min-h-screen bg-[#03060a] text-white relative overflow-x-hidden font-sans"
      style={{
        backgroundImage: "radial-gradient(circle at 80% 20%, rgba(0, 209, 125, 0.06) 0%, transparent 50%), radial-gradient(circle at 10% 80%, rgba(52, 211, 153, 0.04) 0%, transparent 50%)"
      }}
    >
      {/* Background high-tech grid layer */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: "url('/images/bg-grid.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      />

      <aside className="fixed inset-y-0 left-0 z-20 w-[260px] border-r border-[rgba(0,209,125,0.15)] bg-[rgba(5,9,15,0.85)] backdrop-blur-xl shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="flex py-6 px-5 items-center border-b border-[rgba(0,209,125,0.1)] bg-[rgba(0,209,125,0.02)]">
          <SpeedCoreLogo size="sm" subtitle="Internal SEO Tool" href="/" />
        </div>
        
        <div className="px-3 pt-6">
          <div className="mb-3 px-3 text-[11px] font-bold tracking-wider text-primary/80 uppercase">Hệ thống</div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 relative group",
                    active 
                      ? "bg-gradient-to-r from-[rgba(0,209,125,0.15)] to-[rgba(52,211,153,0.05)] text-white border-l-2 border-primary shadow-[0_0_15px_rgba(0,209,125,0.1)]" 
                      : "text-muted hover:text-white hover:bg-[rgba(0,209,125,0.05)] hover:translate-x-[2px]"
                  )}
                >
                  <Icon 
                    size={16} 
                    className={cn(
                      "transition-all duration-200", 
                      active ? "text-primary filter drop-shadow-[0_0_5px_rgba(0,209,125,0.5)]" : "text-muted group-hover:text-white"
                    )} 
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-[rgba(0,209,125,0.1)] p-3 bg-[rgba(0,0,0,0.2)]">
          <form action={logoutAction}>
            <button
              type="submit"
              suppressHydrationWarning
              className="flex w-full min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-all duration-200 hover:bg-[rgba(0,209,125,0.1)] hover:text-white"
            >
              <LogOut size={16} className="text-muted" />
              <span>Đăng xuất</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="min-h-screen min-w-0 pl-[260px] relative z-10">
        <header className="flex h-12 items-center gap-3 border-b border-[rgba(0,209,125,0.12)] bg-[rgba(5,9,14,0.7)] backdrop-blur-md px-6 text-xs text-muted/80 tracking-wide font-medium">
          <Activity size={14} className="text-primary animate-pulse" />
          <span>Speed Core Console</span>
          <span className="text-[rgba(0,209,125,0.3)]">|</span>
          <span>{title}</span>
        </header>
        
        <div className="min-w-0 px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
