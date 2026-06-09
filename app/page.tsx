import { Database, FileText, Mail, Search, Server, ListChecks, ArrowUpRight, ShieldAlert, Cpu } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Panel, Button } from "@/components/ui";

const cards = [
  { label: "Crawl jobs", value: "12", sub: "Hoạt động tích cực", icon: Search, color: "from-emerald-500/20 to-teal-500/10" },
  { label: "URL đã cào", "value": "142,508", sub: "Tăng 12% hôm nay", icon: Server, color: "from-green-500/20 to-emerald-500/10" },
  { label: "Đăng ký diễn đàn", "value": "42.8%", sub: "Đạt mục tiêu (>40%)", icon: ListChecks, color: "from-teal-500/20 to-green-600/10" },
  { label: "Backlink đã đăng", "value": "3,892", sub: "Đang index lập chỉ mục", icon: FileText, color: "from-emerald-600/20 to-teal-600/10" },
  { label: "Email available / total", "value": "892 / 1,200", sub: "Độ tin cậy cao", icon: Mail, color: "from-green-600/20 to-emerald-600/10" },
  { label: "Proxy trong kho", "value": "450 / 500", sub: "Live 90% (Hạn 30d)", icon: Database, color: "from-teal-600/20 to-emerald-500/10" },
  { label: "Registration jobs", "value": "8", sub: "Đang chạy ngầm", icon: ListChecks, color: "from-green-500/20 to-teal-500/10" },
];

export default function HomePage() {
  return (
    <AppShell title="Tổng quan">
      {/* Premium Hero Banner Inspired by AVAX Website layout but Green Themed */}
      <div 
        className="relative overflow-hidden rounded-2xl border border-[rgba(0,209,125,0.25)] bg-[#090e16] p-8 md:p-10 mb-8 shadow-[0_15px_50px_rgba(0,0,0,0.6)] group"
        style={{
          backgroundImage: "linear-gradient(to right, rgba(4,6,10,0.95) 30%, rgba(0,209,125,0.15) 70%, rgba(52,211,153,0.3) 100%), url('/images/aurora-mountain.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      >
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none group-hover:bg-primary/25 transition-all duration-700" />
        
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary tracking-wide mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            BẢNG ĐIỀU HÀNH SPEED-CORE
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
            Tối Ưu Hóa & Tự Động Hóa <br className="hidden sm:inline" />
            Chiến Dịch SEO Hiệu Năng Cao
          </h1>
          <p className="mt-4 text-sm md:text-base text-muted max-w-xl leading-relaxed">
            Hệ thống vận hành tổng thể tích hợp trí tuệ nhân tạo, hỗ trợ quét dork tự động, crawl bài viết diễn đàn và lập chỉ mục backlink hiệu suất tối đa.
          </p>
          
          <div className="mt-6 flex flex-wrap gap-4">
            <a href="/crawler-url">
              <Button className="h-10 px-6 gap-2">
                Bắt đầu crawl <ArrowUpRight size={16} />
              </Button>
            </a>
            <div className="flex items-center gap-4 text-xs font-semibold text-white/80 border-l border-white/20 pl-4">
              <div>
                <span className="text-primary block text-sm font-bold">⏱️ &lt; 10 Phút</span>
                Mỗi vòng đời
              </div>
              <div>
                <span className="text-primary block text-sm font-bold">📈 &gt; 40%</span>
                Tỷ lệ đăng ký
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <Cpu size={18} className="text-primary" />
            Các Chỉ Số Vận Hành
          </h2>
          <p className="text-xs text-muted">Dữ liệu thời gian thực được làm mới liên tục.</p>
        </div>
      </div>

      {/* Modern Dashboard Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <Panel key={item.label} className="relative overflow-hidden group hover:scale-[1.01] hover:-translate-y-[2px] transition-all duration-300">
              {/* Dynamic subtle color card background glow */}
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${item.color} rounded-full blur-[30px] opacity-60 group-hover:scale-125 transition-all duration-500`} />
              
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs text-muted/80 font-medium tracking-wide uppercase">{item.label}</span>
                  <div className="mt-3 text-3xl font-extrabold tracking-tight text-white filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                    {item.value}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-[rgba(0,209,125,0.15)] bg-[#0d141e] text-primary shadow-inner group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-white transition-all duration-300">
                  <Icon size={18} />
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between border-t border-[rgba(0,209,125,0.06)] pt-3 text-[11px] text-muted">
                <span>{item.sub}</span>
                <span className="text-primary font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-all">
                  Chi tiết →
                </span>
              </div>
            </Panel>
          );
        })}
      </div>
    </AppShell>
  );
}
