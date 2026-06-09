"use client";

import { useEffect, useState } from "react";
import { 
  Database, 
  FileText, 
  Mail, 
  Search, 
  Server, 
  ListChecks, 
  Send, 
  Activity, 
  ShieldCheck, 
  Cpu, 
  Network, 
  ArrowRight,
  Sparkles,
  RefreshCw,
  Layers,
  ExternalLink,
  Globe,
  PlusCircle,
  AlertCircle
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Input, Textarea } from "@/components/ui";
import { startCrawlJobAction } from "@/app/crawler-url/actions";

interface DashboardStats {
  crawlJobs: string;
  crawledUrls: string;
  registrationRate: string;
  backlinksPosted: string;
  emailsRatio: string;
  proxiesCount: string;
  registrationJobsRegister: string;
  registrationJobsDirect: string;
}

interface BacklinkRow {
  id: string;
  forum_url: string;
  posted_url: string;
  status: "success" | "failed";
  posted_at: string;
  created_at: string;
  details?: {
    username?: string;
    emailUsed?: string;
    reason?: string;
  };
}

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats>({
    crawlJobs: "0",
    crawledUrls: "0",
    registrationRate: "0%",
    backlinksPosted: "0",
    emailsRatio: "0/0",
    proxiesCount: "0",
    registrationJobsRegister: "0",
    registrationJobsDirect: "0",
  });
  const [recentLinks, setRecentLinks] = useState<BacklinkRow[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Operation Hub States
  const [activeTab, setActiveTab] = useState<"register" | "crawl">("register");
  const [inputUrls, setInputUrls] = useState("");
  const [inputDork, setInputDork] = useState("");
  const [submittingOperation, setSubmittingOperation] = useState(false);
  const [operationMsg, setOperationMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Mouse Move tracking logic for premium glow cards
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        const data = (await res.json()) as DashboardStats;
        setStats(data);
        const now = new Date();
        setLastUpdated(now.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.error("Lỗi tải stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadRecentLinks = async () => {
    setLoadingLinks(true);
    try {
      const res = await fetch("/api/posted-backlinks?page=1&pageSize=6");
      if (res.ok) {
        const data = await res.json();
        setRecentLinks(data.rows || []);
      }
    } catch (err) {
      console.error("Lỗi tải liên kết gần đây:", err);
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleRefreshAll = () => {
    void loadStats();
    void loadRecentLinks();
  };

  useEffect(() => {
    handleRefreshAll();
    const interval = window.setInterval(handleRefreshAll, 12000);
    return () => window.clearInterval(interval);
  }, []);

  // Handle Quick Register Form submission
  const handleQuickRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOperationMsg(null);
    const urls = inputUrls
      .split("\n")
      .map(u => u.trim())
      .filter(u => u.length > 0 && (u.startsWith("http://") || u.startsWith("https://")));

    if (urls.length === 0) {
      setOperationMsg({ type: "error", text: "Vui lòng nhập ít nhất một URL hợp lệ bắt đầu với http/https." });
      return;
    }

    setSubmittingOperation(true);
    try {
      const res = await fetch("/api/registration/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setOperationMsg({ type: "success", text: `Đã đưa thành công ${data.count} URL diễn đàn vào hàng đợi đăng ký!` });
        setInputUrls("");
        void loadStats();
      } else {
        setOperationMsg({ type: "error", text: data.error || "Gặp lỗi khi đưa URL vào hàng đợi." });
      }
    } catch (err: any) {
      setOperationMsg({ type: "error", text: err.message || "Lỗi kết nối máy chủ." });
    } finally {
      setSubmittingOperation(false);
    }
  };

  // Handle Crawler Dork Form submission
  const handleCrawlerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOperationMsg(null);
    if (!inputDork.trim()) {
      setOperationMsg({ type: "error", text: "Vui lòng nhập Dork cào quét Google." });
      return;
    }

    setSubmittingOperation(true);
    try {
      const res = await startCrawlJobAction({
        dorks: inputDork,
        pagesPerDork: 2,
        maxUrls: 300,
      });
      if (res.ok) {
        setOperationMsg({ type: "success", text: `Đã kích hoạt thành công tiến trình cào quét cho dork: "${inputDork}"!` });
        setInputDork("");
        void loadStats();
      } else {
        setOperationMsg({ type: "error", text: res.error || "Không thể kích hoạt tiến trình cào quét." });
      }
    } catch (err: any) {
      setOperationMsg({ type: "error", text: err.message || "Lỗi kết nối máy chủ." });
    } finally {
      setSubmittingOperation(false);
    }
  };

  const getDomainName = (urlStr: string) => {
    try {
      const u = new URL(urlStr);
      return u.hostname;
    } catch {
      return urlStr;
    }
  };

  return (
    <AppShell title="Tổng quan vận hành">
      {/* Cybernetic Nexus Beam Background Element - Inspired by user reference */}
      <div className="nexus-bg-container">
        <div className="cyber-grid-floor" />
        <div className="nexus-beam" />
        <div className="nexus-beam-core" />
      </div>

      {/* Mesh Gradient Top Hero Area - Inspired by Agex Title Section */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.04] bg-[#070b13] px-8 py-12 shadow-2xl glass-card-glow mb-6 animate-fade-in-up">
        {/* Radial glows */}
        <div className="pointer-events-none absolute left-1/3 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] nebula-glow-blue opacity-75 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 top-1/3 h-72 w-72 nebula-glow-violet opacity-65 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-sky/40 bg-brand-sky/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.15em] text-brand-sky">
              <Sparkles size={13} className="animate-pulse" />
              ✦ Speed Core SEO Console
            </span>
            <h1 className="text-shimmer text-5xl font-black tracking-tight leading-tight">
              Hệ Thống Vận Hành Backlink Tự Động
            </h1>
            <p className="max-w-[750px] text-sm font-semibold leading-relaxed text-slate-200">
              Hạ tầng cào quét diễn đàn, đăng ký tài khoản tự động vượt Captcha, đồng bộ kích hoạt email và xuất bản bài viết chứa liên kết SEO độc bản bằng AI Gemini của Khối Crypto Media.
            </p>
          </div>

          {/* KPI Panel */}
          <div className="flex flex-wrap items-center gap-5 rounded-xl border border-white/[0.04] bg-white/[0.02] p-6 backdrop-blur-md">
            <div className="border-r border-white/[0.06] pr-6">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-300">
                <span className="h-2 w-2 rounded-full pulse-glow-cyan" />
                VẬN HÀNH
              </div>
              <div className="mt-1 font-mono text-sm font-black text-white">ACTIVE FLOW</div>
            </div>
            <div className="border-r border-white/[0.06] px-6">
              <div className="text-xs font-black uppercase tracking-wider text-slate-300">CẬP NHẬT</div>
              <div className="mt-1 font-mono text-sm font-black text-brand-sky">{lastUpdated || "--:--:--"}</div>
            </div>
            <div>
              <Button 
                onClick={handleRefreshAll} 
                variant="ghost" 
                className="h-10 px-4 gap-2 border-white/[0.04] bg-brand-sky/10 hover:bg-brand-sky/20 font-black text-xs"
                disabled={loadingStats || loadingLinks}
              >
                <RefreshCw size={14} className={loadingStats ? "animate-spin" : ""} />
                <span className="font-mono tracking-wide text-brand-sky">LÀM MỚI</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Operations Hub (URL & Dork enqueuing) */}
      <div className="grid gap-6 lg:grid-cols-3 mb-8 animate-fade-in-up delay-100">
        {/* Form panel for Actions */}
        <div 
          onMouseMove={handleMouseMove}
          className="lg:col-span-2 rounded-2xl interactive-glow-card p-6 flex flex-col justify-between"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4 border-b border-white/[0.05] pb-3">
              <PlusCircle size={18} className="text-brand-sky" />
              <h3 className="text-base font-black text-white">Bảng kích hoạt luồng tác vụ</h3>
            </div>

            {/* Form switcher tabs */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => { setActiveTab("register"); setOperationMsg(null); }}
                className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg border transition ${
                  activeTab === "register"
                    ? "bg-brand-sky/10 border-brand-sky text-brand-sky animate-pulse"
                    : "border-white/[0.05] hover:bg-white/[0.02] text-slate-300"
                }`}
              >
                Kích hoạt đăng ký URL
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("crawl"); setOperationMsg(null); }}
                className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg border transition ${
                  activeTab === "crawl"
                    ? "bg-brand-sky/10 border-brand-sky text-brand-sky animate-pulse"
                    : "border-white/[0.05] hover:bg-white/[0.02] text-slate-300"
                }`}
              >
                Cào quét Google Dork
              </button>
            </div>

            {/* Messages box */}
            {operationMsg && (
              <div className={`mb-4 p-3.5 rounded-lg border flex items-start gap-2 text-sm font-semibold ${
                operationMsg.type === "success" 
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                  : "bg-red-500/10 border-red-500/25 text-red-400"
              }`}>
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{operationMsg.text}</span>
              </div>
            )}

            {/* Quick Register Tab Content */}
            {activeTab === "register" && (
              <form onSubmit={handleQuickRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-200 mb-2">
                    URL Diễn đàn đi link (Mỗi dòng một URL)
                  </label>
                  <Textarea
                    value={inputUrls}
                    onChange={(e) => setInputUrls(e.target.value)}
                    placeholder="https://forum.example.com/&#10;https://community.another.org/"
                    className="w-full min-h-28 bg-white/[0.02] border-white/[0.06] rounded-xl font-bold text-sm focus:border-brand-sky focus:ring-brand-sky/10 p-3"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-brand-sky hover:bg-brand-sky/90 rounded-xl py-3.5 font-black uppercase tracking-wider text-xs gap-2 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,240,255,0.3)]"
                  disabled={submittingOperation}
                >
                  {submittingOperation ? "Đang xử lý..." : "Bắt đầu đăng ký và đăng bài"}
                </Button>
              </form>
            )}

            {/* Crawl Google Dork Tab Content */}
            {activeTab === "crawl" && (
              <form onSubmit={handleCrawlerSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-200 mb-2">
                    Google Dork tìm kiếm diễn đàn
                  </label>
                  <Input
                    type="text"
                    value={inputDork}
                    onChange={(e) => setInputDork(e.target.value)}
                    placeholder="Powered by Discourse"
                    className="w-full bg-white/[0.02] border-white/[0.06] rounded-xl font-bold text-sm focus:border-brand-sky focus:ring-brand-sky/10 px-4 py-2.5 h-11"
                  />
                  <p className="text-xs font-semibold text-slate-400 mt-2">
                    Cào quét tự động 2 trang đầu Google, trích xuất danh sách ứng viên và tự động phân loại.
                  </p>
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-brand-sky hover:bg-brand-sky/90 rounded-xl py-3.5 font-black uppercase tracking-wider text-xs gap-2 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,240,255,0.3)]"
                  disabled={submittingOperation}
                >
                  {submittingOperation ? "Đang kích hoạt..." : "Khởi chạy Google Crawl Job"}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* System Health / Status widget */}
        <div 
          onMouseMove={handleMouseMove}
          className="rounded-2xl interactive-glow-card p-6 flex flex-col justify-between"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4 border-b border-white/[0.05] pb-3">
              <ShieldCheck size={18} className="text-brand-sky" />
              <h3 className="text-base font-black text-white">Quy chuẩn & Hệ thống</h3>
            </div>
            
            <div className="space-y-4 text-xs leading-relaxed font-bold text-slate-200">
              <div className="flex justify-between items-center py-2.5 border-b border-white/[0.02]">
                <span className="text-white">Proxy SOCKS5:</span>
                <span className="font-mono text-brand-sky font-black text-sm">{stats.proxiesCount} Active</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-white/[0.02]">
                <span className="text-white">Email Pool:</span>
                <span className="font-mono text-brand-sky font-black text-sm">{stats.emailsRatio} Available</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-white/[0.02]">
                <span className="text-white">Gemini Content AI:</span>
                <span className="text-emerald-400 font-black uppercase text-sm">Online</span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-brand-sky/5 border border-brand-sky/15 rounded-xl text-xs font-bold text-slate-200 relative z-10">
            <span className="font-black uppercase block mb-1 text-brand-sky">ℹ Hướng dẫn vận hành</span>
            Bảng điều khiển tối ưu hóa cho phép chạy luồng song song. Proxy tự động xoay vòng cho mỗi luồng đăng ký để tránh bị chặn IP.
          </div>
        </div>
      </div>

      {/* Logical Overview Pillars (3 Columns representing the actual workflow) */}
      <div className="mb-8 animate-fade-in-up delay-200">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-300 mb-5 flex items-center gap-2 pl-1">
          <Layers size={15} className="text-brand-sky" />
          Mô hình vận hành 3 pha (Pipeline Pillars)
        </h2>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* COLUMN 1: CRAWL & RESOURCE ACQUISITION */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-brand-sky/10 border border-brand-sky/20 rounded-xl">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-brand-sky/20 text-brand-sky">
                <Search size={14} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Pha 1: Thu Thập Tài Nguyên
              </span>
            </div>

            <div className="flex flex-col gap-4">
              <div 
                onMouseMove={handleMouseMove}
                className="relative overflow-hidden group interactive-glow-card p-6 rounded-2xl"
              >
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300 group-hover:text-white transition-colors">Crawl Jobs</span>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Tiến trình cào dork đang chạy</p>
                  </div>
                  <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-brand-sky/10 text-brand-sky border border-brand-sky/20 group-hover:border-brand-sky/40 transition-all duration-300">
                    <Search size={15} />
                  </div>
                </div>
                <div className="mt-4 text-4xl font-black tracking-tight text-white relative z-10">{stats.crawlJobs}</div>
              </div>

              <div 
                onMouseMove={handleMouseMove}
                className="relative overflow-hidden group interactive-glow-card p-6 rounded-2xl"
              >
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300 group-hover:text-white transition-colors">URL ứng viên</span>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Liên kết diễn đàn thu hoạch được</p>
                  </div>
                  <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-brand-sky/10 text-brand-sky border border-brand-sky/20 group-hover:border-brand-sky/40 transition-all duration-300">
                    <Server size={15} />
                  </div>
                </div>
                <div className="mt-4 text-4xl font-black tracking-tight text-white relative z-10">{stats.crawledUrls}</div>
              </div>
            </div>
          </div>

          {/* COLUMN 2: REGISTRATION & CAPTCHA SOLVING */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-brand-sky/10 border border-brand-sky/20 rounded-xl">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-brand-sky/20 text-brand-sky">
                <Network size={14} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Pha 2: Tự Động Hóa Tài Khoản
              </span>
            </div>

            <div className="flex flex-col gap-4">
              <div 
                onMouseMove={handleMouseMove}
                className="relative overflow-hidden group interactive-glow-card p-6 rounded-2xl"
              >
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300 group-hover:text-white transition-colors">Hàng Đợi Đăng Ký</span>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Tiến trình đăng ký hồ sơ tự động</p>
                  </div>
                  <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-brand-sky/10 text-brand-sky border border-brand-sky/20 group-hover:border-brand-sky/40 transition-all duration-300">
                    <Cpu size={15} />
                  </div>
                </div>
                <div className="mt-4 text-4xl font-black tracking-tight text-white relative z-10">{stats.registrationJobsRegister}</div>
              </div>

              <div 
                onMouseMove={handleMouseMove}
                className="relative overflow-hidden group interactive-glow-card p-6 rounded-2xl"
              >
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300 group-hover:text-white transition-colors">Tỷ lệ đăng ký thành công</span>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Tỷ lệ hoàn thành kích hoạt mail</p>
                  </div>
                  <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-brand-sky/10 text-brand-sky border border-brand-sky/20 group-hover:border-brand-sky/40 transition-all duration-300">
                    <ListChecks size={15} />
                  </div>
                </div>
                <div className="mt-4 text-4xl font-black tracking-tight text-brand-sky relative z-10">{stats.registrationRate}</div>
              </div>
            </div>
          </div>

          {/* COLUMN 3: PUBLISHING & BACKLINK OUTCOMES */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-brand-sky/10 border border-brand-sky/20 rounded-xl">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-brand-sky/20 text-brand-sky">
                <Send size={14} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Pha 3: Xuất Bản & Hiệu Quả
              </span>
            </div>

            <div className="flex flex-col gap-4">
              <div 
                onMouseMove={handleMouseMove}
                className="relative overflow-hidden group interactive-glow-card p-6 rounded-2xl"
              >
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300 group-hover:text-white transition-colors">Hàng Đợi Đăng Bài</span>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Luồng soạn bài & đi link bài viết</p>
                  </div>
                  <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-brand-sky/10 text-brand-sky border border-brand-sky/20 group-hover:border-brand-sky/40 transition-all duration-300">
                    <Send size={15} />
                  </div>
                </div>
                <div className="mt-4 text-4xl font-black tracking-tight text-white relative z-10">{stats.registrationJobsDirect}</div>
              </div>

              <div 
                onMouseMove={handleMouseMove}
                className="relative overflow-hidden group interactive-glow-card p-6 rounded-2xl"
              >
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300 group-hover:text-white transition-colors">Tổng backlink đã sống</span>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Đã xuất bản và sync Google Sheet</p>
                  </div>
                  <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-brand-sky/10 text-brand-sky border border-brand-sky/20 group-hover:border-brand-sky/40 transition-all duration-300">
                    <FileText size={15} />
                  </div>
                </div>
                <div className="mt-4 text-4xl font-black tracking-tight text-white relative z-10">{stats.backlinksPosted}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Real-time Live Posted Backlinks Table */}
      <div 
        onMouseMove={handleMouseMove}
        className="rounded-2xl interactive-glow-card p-6 animate-fade-in-up delay-300"
      >
        <div className="flex items-center justify-between mb-5 relative z-10">
          <div>
            <h2 className="text-lg font-black text-white">Lịch sử xuất bản Backlink thời gian thực</h2>
            <p className="text-sm font-bold text-slate-300">Liên kết của bài viết chứa Anchor Text đã đăng thành công</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-sky/15 px-3 py-1.5 text-xs font-mono font-black text-brand-sky border border-brand-sky/30">
            <span className="h-2 w-2 rounded-full pulse-glow-cyan" />
            LIVE STATUS TRACKER
          </span>
        </div>

        {loadingLinks ? (
          <div className="flex flex-col items-center justify-center py-12 text-sm font-bold text-slate-300 gap-2 relative z-10">
            <RefreshCw size={18} className="animate-spin text-brand-sky" />
            <span>Đang truy xuất dữ liệu từ cơ sở dữ liệu...</span>
          </div>
        ) : recentLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-sm font-bold text-slate-400 border border-dashed border-white/[0.04] rounded-xl bg-white/[0.01] relative z-10">
            <Globe size={24} className="text-slate-500 mb-2" />
            <span>Chưa tìm thấy dữ liệu liên kết nào đã được ghi nhận.</span>
          </div>
        ) : (
          <div className="overflow-x-auto relative z-10">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-white/90 uppercase font-mono tracking-wider">
                  <th className="pb-4 font-black">Tên Diễn Đàn</th>
                  <th className="pb-4 font-black">Tài Khoản (Username)</th>
                  <th className="pb-4 font-black">Liên Kết Live (Posted URL)</th>
                  <th className="pb-4 font-black">Thời Gian</th>
                  <th className="pb-4 font-black text-right">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] font-bold text-slate-200">
                {recentLinks.map((link) => (
                  <tr key={link.id} className="group hover:bg-white/[0.01] transition-all duration-200">
                    <td className="py-4.5 pr-2">
                      <span className="font-mono text-white font-black block max-w-[200px] truncate group-hover:text-brand-sky transition-colors">
                        {getDomainName(link.forum_url)}
                      </span>
                      <span className="text-xs font-semibold text-slate-400 block font-mono max-w-[200px] truncate">{link.forum_url}</span>
                    </td>
                    <td className="py-4.5 text-white font-black font-mono">
                      {String(link.details?.username || "auto_poster")}
                    </td>
                    <td className="py-4.5 font-mono">
                      {link.status === "success" ? (
                        <a 
                          href={link.posted_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-brand-sky hover:underline flex items-center gap-1 font-mono font-black max-w-[360px] truncate"
                        >
                          {link.posted_url}
                          <ExternalLink size={12} className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </a>
                      ) : (
                        <span className="text-red-400 font-bold block max-w-[360px] truncate">
                          Lỗi: {link.details?.reason || "Không thể đăng bài"}
                        </span>
                      )}
                    </td>
                    <td className="py-4.5 font-mono text-slate-300 font-bold">
                      {new Date(link.posted_at || link.created_at).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit"
                      })}
                    </td>
                    <td className="py-4.5 text-right">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black border transition-all duration-300 ${
                        link.status === "success"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20 group-hover:bg-red-500/20"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${link.status === "success" ? "bg-emerald-400 animate-ping" : "bg-red-400"}`} />
                        {link.status === "success" ? "LIVE" : "FAILED"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
