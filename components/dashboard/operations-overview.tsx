import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  ListChecks,
  Mail,
  Search,
  Server,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { Panel } from "@/components/ui";
import type { DashboardStatsSafe } from "@/lib/services/dashboard-stats";
import { cn } from "@/lib/utils";

const REGISTRATION_TARGET = 40;
const LIFECYCLE_TARGET_MIN = 10;

const quickLinks = [
  { href: "/crawler-url", label: "Cào Dork & Crawl", icon: Search },
  { href: "/backlink-opportunities", label: "Cơ hội Backlink", icon: Target },
  { href: "/register-forum", label: "Đăng ký diễn đàn", icon: ListChecks },
  { href: "/registered-forums", label: "Diễn đàn đã ĐK", icon: ShieldCheck },
  { href: "/posted-backlinks", label: "Backlink đã đăng", icon: FileText },
  { href: "/resources", label: "Tài nguyên", icon: Database },
];

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function statusTone(status: string) {
  if (status === "running" || status === "processing") return "text-sky-300";
  if (status === "completed" || status === "success") return "text-primary";
  if (status === "queued") return "text-yellow-300";
  if (status === "failed" || status === "cancelled") return "text-red-300";
  return "text-muted";
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: "default" | "good" | "warn" | "bad";
  href?: string;
}) {
  const toneClass =
    tone === "good"
      ? "border-primary/30 bg-primary/[0.06]"
      : tone === "warn"
        ? "border-yellow-500/30 bg-yellow-500/[0.06]"
        : tone === "bad"
          ? "border-red-500/30 bg-red-500/[0.06]"
          : "border-border bg-panel";

  const content = (
    <Panel className={cn("h-full min-h-[7.5rem]", toneClass, href && "transition hover:border-primary/40")}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-muted">{label}</div>
        <Icon className="shrink-0 text-muted" size={17} />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </Panel>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}

function MetricBar({ label, value, total, color = "bg-primary" }: { label: string; value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-medium text-white">
          {formatNumber(value)}
          <span className="text-muted"> · {pct}%</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#162130]">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function OperationsOverview({ stats }: { stats: DashboardStatsSafe }) {
  const regTone =
    stats.registration.successRate >= REGISTRATION_TARGET
      ? "good"
      : stats.registration.successRate > 0
        ? "warn"
        : "default";
  const lifecycleTone =
    stats.registration.avgLifecycleMin > 0 && stats.registration.avgLifecycleMin <= LIFECYCLE_TARGET_MIN
      ? "good"
      : stats.registration.avgLifecycleMin > LIFECYCLE_TARGET_MIN
        ? "bad"
        : "default";

  const candidateTotal = stats.crawl.candidateRatings.reduce((sum, item) => sum + item.count, 0);
  const ratingColors: Record<string, string> = {
    Ngon: "bg-primary",
    "Có tiềm năng": "bg-emerald-500",
    "Xem xét": "bg-yellow-400",
    "Không có tiềm năng": "bg-slate-500",
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Tổng quan vận hành</h1>
          <p className="mt-1 text-sm text-muted">
            Mục tiêu: tỷ lệ đăng ký thành công &gt; {REGISTRATION_TARGET}%, mỗi vòng đời &lt; {LIFECYCLE_TARGET_MIN} phút.
          </p>
        </div>
        <p className="text-xs text-muted">Cập nhật: {formatDate(stats.fetchedAt)}</p>
      </div>

      {stats.loadError ? (
        <Panel className="border-red-500/30 bg-red-500/[0.06]">
          <div className="flex items-start gap-3 text-sm text-red-200">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Không tải đủ dữ liệu dashboard</p>
              <p className="mt-1 text-red-200/80">{stats.loadError}</p>
            </div>
          </div>
        </Panel>
      ) : null}

      <section>
        <SectionTitle>KPI vận hành</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Tỷ lệ đăng ký thành công"
            value={`${stats.registration.successRate}%`}
            hint={`${formatNumber(stats.registration.success)} thành công / ${formatNumber(stats.registration.success + stats.registration.failed)} kết thúc`}
            icon={TrendingUp}
            tone={regTone}
            href="/register-forum"
          />
          <KpiCard
            label="Vòng đời đăng ký TB"
            value={stats.registration.avgLifecycleMin > 0 ? `${stats.registration.avgLifecycleMin} phút` : "—"}
            hint={`Mục tiêu < ${LIFECYCLE_TARGET_MIN} phút`}
            icon={Clock}
            tone={lifecycleTone}
            href="/register-forum"
          />
          <KpiCard
            label="Backlink còn sống"
            value={`${formatNumber(stats.backlinks.postedAlive)}/${formatNumber(stats.backlinks.postedTotal)}`}
            hint="Link đã đăng và còn alive"
            icon={CheckCircle2}
            tone={stats.backlinks.postedAlive > 0 ? "good" : "default"}
            href="/posted-backlinks"
          />
          <KpiCard
            label="Cần review thủ công"
            value={formatNumber(stats.crawl.manualReview)}
            hint="CAPTCHA / Cloudflare / login wall"
            icon={AlertTriangle}
            tone={stats.crawl.manualReview > 0 ? "warn" : "default"}
            href="/crawler-url"
          />
        </div>
      </section>

      <section>
        <SectionTitle>Chỉ số nhanh</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <KpiCard label="Crawl jobs" value={formatNumber(stats.crawl.jobsTotal)} hint={`${stats.crawl.jobsRunning} đang chạy · ${stats.crawl.jobsQueued} chờ`} icon={Search} href="/crawler-url" />
          <KpiCard label="URL đã cào" value={formatNumber(stats.crawl.urlsTotal)} hint={`${formatNumber(stats.crawl.urlsSuccess)} OK · ${formatNumber(stats.crawl.urlsFailed)} lỗi`} icon={Server} href="/crawler-url" />
          <KpiCard label="Registration jobs" value={formatNumber(stats.registration.jobsTotal)} hint={`${stats.registration.processing} xử lý · ${stats.registration.queued} chờ`} icon={ListChecks} href="/register-forum" />
          <KpiCard label="Diễn đàn đã đăng ký" value={formatNumber(stats.registration.registeredAccounts)} hint="Có username & password" icon={ShieldCheck} href="/registered-forums" />
          <KpiCard label="Cơ hội backlink" value={formatNumber(stats.backlinks.opportunitiesTotal)} hint={`${stats.backlinks.projectsTotal} dự án · ${stats.backlinks.opportunityJobsRunning} job chạy`} icon={Target} href="/backlink-opportunities" />
          <KpiCard label="Forum khám phá (Dork)" value={formatNumber(stats.discovery.discoveredForums)} hint={`${stats.discovery.dorkProjects} dự án · ${stats.discovery.forumsImported} đã import`} icon={Search} href="/crawler-url" />
          <KpiCard label="Email khả dụng" value={`${formatNumber(stats.resources.emailsAvailable)}/${formatNumber(stats.resources.emailsTotal)}`} hint={`${stats.resources.emailsLocked} đang khóa`} icon={Mail} href="/resources" />
          <KpiCard label="Proxy khả dụng" value={`${formatNumber(stats.resources.proxiesAvailable)}/${formatNumber(stats.resources.proxiesTotal)}`} hint={`${stats.resources.proxiesDead} dead`} icon={Database} href="/resources" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Panel>
          <SectionTitle
            action={
              <Link href="/crawler-url" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Xem crawler <ArrowRight size={14} />
              </Link>
            }
          >
            Pipeline thu thập & đánh giá
          </SectionTitle>
          <div className="space-y-4">
            <MetricBar label="URL crawl thành công" value={stats.crawl.urlsSuccess} total={stats.crawl.urlsTotal} />
            <MetricBar label="Forum khám phá từ Dork" value={stats.discovery.discoveredForums} total={Math.max(stats.discovery.discoveredForums, stats.crawl.urlsTotal)} color="bg-sky-400" />
            <MetricBar label="Đăng ký thành công" value={stats.registration.success} total={Math.max(stats.registration.jobsTotal, 1)} color="bg-emerald-400" />
            <MetricBar label="Backlink đã đăng" value={stats.backlinks.postedTotal} total={Math.max(stats.registration.registeredAccounts, stats.backlinks.postedTotal, 1)} color="bg-violet-400" />
          </div>
          <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-semibold text-muted">CMS phổ biến (mẫu gần đây)</p>
              <div className="space-y-2">
                {stats.crawl.cmsBreakdown.length > 0 ? (
                  stats.crawl.cmsBreakdown.map((item) => (
                    <div key={item.cms} className="flex items-center justify-between text-sm">
                      <span className="text-white">{item.cms}</span>
                      <span className="text-muted">{formatNumber(item.count)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted">Chưa có dữ liệu CMS.</p>
                )}
              </div>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold text-muted">Phân bổ đánh giá URL ({formatNumber(candidateTotal)} mẫu)</p>
              <div className="space-y-2">
                {stats.crawl.candidateRatings.map((item) => (
                  <MetricBar
                    key={item.label}
                    label={item.label}
                    value={item.count}
                    total={Math.max(candidateTotal, 1)}
                    color={ratingColors[item.label] ?? "bg-primary"}
                  />
                ))}
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted">
            Thời gian crawl TB: {stats.crawl.avgCrawlTimeSec > 0 ? `${stats.crawl.avgCrawlTimeSec}s` : "—"} · Persona trong kho: {formatNumber(stats.resources.personasTotal)}
          </p>
        </Panel>

        <Panel>
          <SectionTitle>Truy cập nhanh</SectionTitle>
          <div className="grid gap-2">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-md border border-border bg-[#0b111b] px-3 py-2.5 text-sm transition hover:border-primary/40 hover:bg-[#111b29]"
                >
                  <span className="inline-flex items-center gap-2 font-medium text-white">
                    <Icon size={16} className="text-primary" />
                    {item.label}
                  </span>
                  <ArrowRight size={15} className="text-muted" />
                </Link>
              );
            })}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionTitle
            action={
              <Link href="/crawler-url" className="text-xs text-primary hover:underline">
                Tất cả jobs
              </Link>
            }
          >
            Crawl jobs gần đây
          </SectionTitle>
          {stats.crawl.recentJobs.length > 0 ? (
            <div className="overflow-hidden rounded-md border border-border">
              <div className="grid grid-cols-[minmax(0,1.2fr)_88px_72px_72px] border-b border-border bg-[#0b111b] px-3 py-2 text-xs font-semibold text-muted">
                <span>Job</span>
                <span>Trạng thái</span>
                <span className="text-right">Tiến độ</span>
                <span className="text-right">OK/Lỗi</span>
              </div>
              <div className="divide-y divide-border">
                {stats.crawl.recentJobs.map((job) => (
                  <div key={job.id} className="grid grid-cols-[minmax(0,1.2fr)_88px_72px_72px] items-center gap-2 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white" title={job.name ?? job.id}>
                        {job.name || `Job ${job.id.slice(0, 8)}`}
                      </p>
                      <p className="truncate text-xs text-muted">{formatDate(job.created_at)}</p>
                    </div>
                    <span className={cn("text-xs font-semibold uppercase", statusTone(job.status))}>{job.status}</span>
                    <span className="text-right text-xs text-muted">
                      {job.processed_urls}/{job.total_urls}
                    </span>
                    <span className="text-right text-xs">
                      <span className="text-primary">{job.success_count}</span>
                      <span className="text-muted">/</span>
                      <span className="text-red-300">{job.failed_count}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Chưa có crawl job nào.</p>
          )}
        </Panel>

        <Panel>
          <SectionTitle
            action={
              <Link href="/register-forum" className="text-xs text-primary hover:underline">
                Hàng đợi đăng ký
              </Link>
            }
          >
            Registration jobs gần đây
          </SectionTitle>
          {stats.registration.recentJobs.length > 0 ? (
            <div className="overflow-hidden rounded-md border border-border">
              <div className="grid grid-cols-[minmax(0,1fr)_88px_72px] border-b border-border bg-[#0b111b] px-3 py-2 text-xs font-semibold text-muted">
                <span>URL / CMS</span>
                <span>Trạng thái</span>
                <span className="text-right">Cập nhật</span>
              </div>
              <div className="divide-y divide-border">
                {stats.registration.recentJobs.map((job) => (
                  <div key={job.id} className="grid grid-cols-[minmax(0,1fr)_88px_72px] items-center gap-2 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white" title={job.url}>
                        {job.url}
                      </p>
                      <p className="truncate text-xs text-muted">{job.cms_type}</p>
                    </div>
                    <span className={cn("text-xs font-semibold uppercase", statusTone(job.status))}>{job.status}</span>
                    <span className="text-right text-xs text-muted">{formatDate(job.updated_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Chưa có registration job nào.</p>
          )}
        </Panel>
      </section>

      <Panel>
        <SectionTitle
          action={
            <Link href="/posted-backlinks" className="text-xs text-primary hover:underline">
              Tất cả backlink
            </Link>
          }
        >
          Backlink đăng gần đây
        </SectionTitle>
        {stats.backlinks.recentPosted.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-border">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px_72px] border-b border-border bg-[#0b111b] px-3 py-2 text-xs font-semibold text-muted">
              <span>Forum</span>
              <span>Bài đăng</span>
              <span>Trạng thái</span>
              <span className="text-right">Alive</span>
            </div>
            <div className="divide-y divide-border">
              {stats.backlinks.recentPosted.map((item) => (
                <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px_72px] items-center gap-2 px-3 py-2.5 text-sm">
                  <a href={item.forum_url} target="_blank" rel="noreferrer" className="truncate text-white hover:text-primary hover:underline" title={item.forum_url}>
                    {item.forum_url}
                  </a>
                  <a href={item.posted_url} target="_blank" rel="noreferrer" className="truncate text-muted hover:text-primary hover:underline" title={item.posted_url}>
                    {item.posted_url}
                  </a>
                  <span className={cn("text-xs font-semibold uppercase", statusTone(item.status))}>{item.status}</span>
                  <span className={cn("text-right text-xs font-semibold", item.is_alive ? "text-primary" : "text-red-300")}>
                    {item.is_alive ? "Yes" : "No"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Chưa có backlink nào được đăng.</p>
        )}
      </Panel>
    </div>
  );
}
