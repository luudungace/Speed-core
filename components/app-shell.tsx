"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Database,
  FileText,
  Link2,
  ListChecks,
  PanelsTopLeft,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="min-h-screen bg-background text-white">
      <aside className="fixed inset-y-0 left-0 z-20 w-[250px] border-r border-border bg-[#060b13]">
        <div className="flex h-16 items-center gap-3 px-3">
          <div className="grid size-9 place-items-center rounded-md bg-emerald-500/16 text-primary">
            <Link2 size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold">Backlink Console</div>
            <div className="text-xs text-muted">Internal SEO Tool</div>
          </div>
        </div>
        <div className="px-2 pt-4">
          <div className="mb-2 px-2 text-xs font-semibold text-muted">Vận hành</div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-8 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white transition",
                    active ? "bg-[#162130]" : "hover:bg-[#101823]",
                  )}
                >
                  <Icon size={17} className="text-slate-200" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <main className="min-h-screen pl-[250px]">
        <header className="flex h-10 items-center gap-3 border-b border-border bg-panel2 px-5 text-sm text-muted">
          <Activity size={16} />
          <span>{title}</span>
        </header>
        <div className="px-6 py-7">{children}</div>
      </main>
    </div>
  );
}
