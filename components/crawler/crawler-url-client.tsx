"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Download, Pause, Play, RefreshCw, Square, Trash2 } from "lucide-react";
import { cancelCrawlJobAction, setCrawlJobPausedAction, startCrawlJobAction } from "@/app/crawler-url/actions";
import { Button, Input, Panel, Select, Textarea } from "@/components/ui";
import type { ContactItem, CrawlJobRow, CrawlLogRow, CrawlResultRow } from "@/lib/types/crawler";
import { getCrawlerRegisterLink } from "@/lib/utils/auth-links";
import { normalizeExcludeDomains } from "@/lib/utils/crawler-filters";

const DEFAULT_DORKS = 'intitle:"forum" "register" "submit a thread"\nsite:*.org "powered by xenforo"';
const DEFAULT_EXCLUDE = "wikipedia.org\nreddit.com\nquora.com";
const CRAWLER_VIEW_STATE_KEY = "crawler_url_view_state";
const CMS_OPTIONS = ["All CMS", "XenForo", "WordPress", "vBulletin", "phpBB", "Unknown"];
const URL_DEPTH_OPTIONS = ["Tất cả URL", "Chỉ domain", "Domain + 1 path", "URL sâu (bài viết)"];
const REGISTER_FILTER_OPTIONS = [
  ["all", "Tất cả Register"],
  ["with", "Có Register"],
  ["without", "Không Register"],
];
const STATUS_FILTER_OPTIONS = [
  ["all", "Tất cả Status"],
  ["success", "Success"],
  ["other", "Còn lại"],
];

function values(items: ContactItem[]) {
  return items.map((item) => item.value).join(", ") || "-";
}

function ContactLines({ items }: { items: ContactItem[] }) {
  if (items.length === 0) return <>-</>;
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item, index) => (
        <span key={`${item.value}-${index}`} className="block leading-snug">
          {item.value}
        </span>
      ))}
    </div>
  );
}

function AuthLinkCell({ row }: { row: CrawlResultRow }) {
  const registerUrl = getCrawlerRegisterLink({
    url: row.url,
    domain: row.domain,
    cmsType: row.cms_type,
  });

  if (!registerUrl) return null;

  return (
    <div className="font-mono text-xs">
      <a
        href={registerUrl}
        target="_blank"
        rel="noreferrer"
        title={registerUrl}
        className="text-cyan-300 hover:underline"
      >
        Dang ky
      </a>
    </div>
  );
}

function formatJobTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function jobStatusClass(status: CrawlJobRow["status"]) {
  if (status === "completed") return "text-primary";
  if (status === "failed") return "text-red-300";
  if (status === "cancelled" || status === "paused") return "text-amber-300";
  return "text-sky-300";
}

export default function CrawlerUrlClient() {
  const [jobName, setJobName] = useState("");
  const [dorks, setDorks] = useState(DEFAULT_DORKS);
  const [pagesPerDork, setPagesPerDork] = useState(2);
  const [maxUrls, setMaxUrls] = useState(500);
  const [excludeDomains, setExcludeDomains] = useState(DEFAULT_EXCLUDE);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultJobId, setResultJobId] = useState<string | null>(null);
  const [job, setJob] = useState<CrawlJobRow | null>(null);
  const [logs, setLogs] = useState<CrawlLogRow[]>([]);
  const [history, setHistory] = useState<CrawlJobRow[]>([]);
  const [rows, setRows] = useState<CrawlResultRow[]>([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [cms, setCms] = useState("All CMS");
  const [urlDepth, setUrlDepth] = useState("Tất cả URL");
  const [registerFilter, setRegisterFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [excludeSyncMessage, setExcludeSyncMessage] = useState<string | null>(null);
  const [isViewStateReady, setIsViewStateReady] = useState(false);
  const searchEffectReady = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [isCancelling, startCancelTransition] = useTransition();
  const [isPausing, startPauseTransition] = useTransition();
  const [dorkScrollTop, setDorkScrollTop] = useState(0);
  const [excludeScrollTop, setExcludeScrollTop] = useState(0);
  const excludeLineNumbers = useMemo(() => {
    const lineCount = Math.max(1, excludeDomains === "" ? 1 : excludeDomains.split(/\r?\n/).length);
    return Array.from({ length: lineCount }, (_, index) => index + 1);
  }, [excludeDomains]);
  const dorkLineNumbers = useMemo(() => {
    const lineCount = Math.max(1, dorks === "" ? 1 : dorks.split(/\r?\n/).length);
    return Array.from({ length: Math.min(10, lineCount) }, (_, index) => index + 1);
  }, [dorks]);

  const isJobActive = job?.status === "running" || job?.status === "queued" || job?.status === "paused";

  const totalPages = Math.max(1, Math.ceil(count / 20));
  const progress = useMemo(() => {
    if (!job || job.total_urls === 0) return 0;
    return Math.round((job.processed_urls / job.total_urls) * 100);
  }, [job]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedExclude = localStorage.getItem("exclude_domains");
    if (savedExclude !== null) setExcludeDomains(savedExclude);

    const savedViewState = localStorage.getItem(CRAWLER_VIEW_STATE_KEY);
    if (savedViewState) {
      try {
        const parsed = JSON.parse(savedViewState) as Partial<{
          page: number;
          search: string;
          cms: string;
          registerFilter: string;
          statusFilter: string;
          urlDepth: string;
          resultJobId: string | null;
        }>;

        if (typeof parsed.page === "number" && parsed.page > 0) setPage(parsed.page);
        if (typeof parsed.search === "string") setSearch(parsed.search);
        if (typeof parsed.cms === "string") setCms(parsed.cms);
        if (typeof parsed.registerFilter === "string") setRegisterFilter(parsed.registerFilter);
        if (typeof parsed.statusFilter === "string") setStatusFilter(parsed.statusFilter);
        if (typeof parsed.urlDepth === "string") setUrlDepth(parsed.urlDepth);
        if (typeof parsed.resultJobId === "string" && parsed.resultJobId) {
          setResultJobId(parsed.resultJobId);
        }
      } catch {
        localStorage.removeItem(CRAWLER_VIEW_STATE_KEY);
      }
    }

    setIsViewStateReady(true);
  }, []);

  useEffect(() => {
    if (!isViewStateReady || typeof window === "undefined") return;

    localStorage.setItem(
      CRAWLER_VIEW_STATE_KEY,
      JSON.stringify({
        page,
        search,
        cms,
        registerFilter,
        statusFilter,
        urlDepth,
        resultJobId,
      }),
    );
  }, [isViewStateReady, page, search, cms, registerFilter, statusFilter, urlDepth, resultJobId]);

  async function loadResults() {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      search,
      cms,
      registerFilter,
      status: statusFilter,
      urlDepth,
    });
    if (resultJobId) params.set("jobId", resultJobId);
    const response = await fetch(`/api/crawler/results?${params.toString()}`);
    const data = (await response.json()) as { rows: CrawlResultRow[]; count: number; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Không tải được kết quả.");
    setRows(data.rows);
    setCount(data.count);
    setSelected([]);
  }

  async function loadHistory() {
    const response = await fetch("/api/crawler/jobs?limit=20", { cache: "no-store" });
    const data = (await response.json()) as { jobs: CrawlJobRow[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Khong tai duoc lich su crawl.");
    setHistory(data.jobs);
  }

  useEffect(() => {
    if (!isViewStateReady) return;
    void loadResults().catch((err: Error) => setError(err.message));
    void loadHistory().catch((err: Error) => setError(err.message));
  }, [isViewStateReady, page, cms, registerFilter, statusFilter, urlDepth, resultJobId]);

  useEffect(() => {
    if (!isViewStateReady) return;
    if (!searchEffectReady.current) {
      searchEffectReady.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      setPage(1);
      void loadResults().catch((err: Error) => setError(err.message));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isViewStateReady, search]);

  function appendDomainsToExclude(domains: string[], sourceLabel: string) {
    const normalized = normalizeExcludeDomains(domains.join("\n"));
    if (normalized.length === 0) {
      setExcludeSyncMessage(`Khong co domain hop le tu ${sourceLabel}.`);
      return;
    }

    const currentDomains = normalizeExcludeDomains(excludeDomains);
    const before = currentDomains.length;
    const domainSet = new Set([...currentDomains, ...normalized]);
    const updatedDomains = Array.from(domainSet);
    const addedCount = updatedDomains.length - before;
    const updated = updatedDomains.join("\n");

    setExcludeDomains(updated);
    localStorage.setItem("exclude_domains", updated);
    setExcludeSyncMessage(
      addedCount > 0
        ? `Da them ${addedCount} domain moi tu ${sourceLabel}, tong ${updatedDomains.length}.`
        : `Khong co domain moi tu ${sourceLabel}; cac domain nay da nam trong Loai tru. Tong ${updatedDomains.length}.`,
    );
  }

  useEffect(() => {
    if (!isViewStateReady) return;
    if (!jobId) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/crawler/jobs/${jobId}`);
      const data = (await response.json()) as { job: CrawlJobRow; logs: CrawlLogRow[] };
      if (response.ok) {
        setJob(data.job);
        setLogs(data.logs);
        void loadHistory().catch((err: Error) => setError(err.message));
        await loadResults();
        if (["completed", "failed", "cancelled"].includes(data.job.status)) {
          window.clearInterval(timer);
        }
      }
    }, 1800);
    return () => window.clearInterval(timer);
  }, [isViewStateReady, jobId, page, search, cms, registerFilter, statusFilter, resultJobId]);

  function stopJob() {
    if (!jobId) return;
    setError(null);
    startCancelTransition(async () => {
      const result = await cancelCrawlJobAction(jobId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const response = await fetch(`/api/crawler/jobs/${jobId}`);
      const data = (await response.json()) as { job: CrawlJobRow; logs: CrawlLogRow[] };
      if (response.ok) {
        setJob(data.job);
        setLogs(data.logs);
        void loadHistory().catch((err: Error) => setError(err.message));
      }
    });
  }

  function togglePauseJob() {
    if (!jobId || !job) return;
    const shouldPause = job.status !== "paused";
    setError(null);
    startPauseTransition(async () => {
      const result = await setCrawlJobPausedAction(jobId, shouldPause);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const response = await fetch(`/api/crawler/jobs/${jobId}`);
      const data = (await response.json()) as { job: CrawlJobRow; logs: CrawlLogRow[] };
      if (response.ok) {
        setJob(data.job);
        setLogs(data.logs);
        void loadHistory().catch((err: Error) => setError(err.message));
      }
    });
  }

  function startJob() {
    setError(null);
    startTransition(async () => {
      const result = await startCrawlJobAction({
        dorks,
        pagesPerDork,
        name: jobName,
        maxUrls,
        excludeDomains,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setJobId(result.jobId);
      setResultJobId(result.jobId);
      setPage(1);
      if (typeof window !== "undefined") {
        localStorage.setItem(
          CRAWLER_VIEW_STATE_KEY,
          JSON.stringify({
            page: 1,
            search,
            cms,
            registerFilter,
            statusFilter,
            urlDepth,
            resultJobId: result.jobId,
          }),
        );
      }
      setRows([]);
      setCount(0);
      setSelected([]);
      const response = await fetch(`/api/crawler/jobs/${result.jobId}`);
      const data = (await response.json()) as { job: CrawlJobRow; logs: CrawlLogRow[] };
      if (response.ok) {
        setJob(data.job);
        setLogs(data.logs);
        void loadHistory().catch((err: Error) => setError(err.message));
      } else {
        setLogs([]);
      }
    });
  }

  async function syncVisibleResultDomains() {
    setExcludeSyncMessage("Dang lay domain tu toan bo Ket qua hien tai...");
    const params = new URLSearchParams({
      page: "1",
      pageSize: "2000",
      search,
      cms,
      registerFilter,
      status: statusFilter,
      urlDepth,
    });
    if (resultJobId) params.set("jobId", resultJobId);
    const response = await fetch(`/api/crawler/results?${params.toString()}`, { cache: "no-store" });
    const data = (await response.json()) as { rows: CrawlResultRow[]; count: number; error?: string };
    if (!response.ok) {
      setExcludeSyncMessage(data.error ?? "Khong lay duoc domain tu Ket qua hien tai.");
      return;
    }

    appendDomainsToExclude(data.rows.map((row) => row.domain), `Ket qua hien tai (${data.count})`);
  }

  async function deleteSelected() {
    if (selected.length === 0) return;
    const response = await fetch("/api/crawler/results", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Không xóa được kết quả.");
      return;
    }
    await loadResults();
  }

const exportParams = new URLSearchParams({ search, cms, registerFilter, status: statusFilter, urlDepth });
if (resultJobId) exportParams.set("jobId", resultJobId);
const exportUrl = `/api/crawler/export?${exportParams.toString()}`;

  return (
    <>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_514px]">
        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-semibold">Tên job</label>
              <Input
                value={jobName}
                onChange={(event) => setJobName(event.target.value)}
                placeholder="VD: XenForo US — tuần 1"
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Max URL</label>
              <Input
                type="number"
                min={10}
                max={2000}
                value={maxUrls}
                onChange={(event) =>
                  setMaxUrls(Math.max(10, Math.min(2000, Number(event.target.value) || 500)))
                }
                className="w-full"
              />
              <p className="mt-1 text-xs text-muted">Giới hạn URL crawl sau khi tìm từ Serper (10–2000).</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Trang / dork</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={pagesPerDork}
                onChange={(event) => setPagesPerDork(Math.max(1, Math.min(10, Number(event.target.value))))}
                className="w-full"
              />
            </div>
          </div>

          <label className="mt-4 block text-sm font-semibold">Loại trừ domain</label>
          <p className="mt-0.5 text-xs text-muted">Mỗi dòng một domain. Tự bỏ trùng và khớp cả subdomain.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button className="h-8 px-2 text-xs" variant="ghost" onClick={syncVisibleResultDomains}>
              Them domain tu Ket qua hien tai
            </Button>
            {excludeSyncMessage ? <span className="text-xs text-muted">{excludeSyncMessage}</span> : null}
          </div>
          <div className="mt-2 flex h-24 overflow-hidden rounded-lg border border-emerald-500/20 bg-panel2 font-mono text-sm shadow-inner shadow-black/20 transition-all focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/25">
            <div className="w-12 shrink-0 select-none overflow-hidden border-r border-emerald-500/15 bg-black/20 px-2 py-3 text-right text-xs font-semibold leading-5 text-emerald-300/80">
              <div style={{ transform: `translateY(-${excludeScrollTop}px)` }}>
                {excludeLineNumbers.map((lineNumber) => (
                  <div key={lineNumber} className="h-5 leading-5">
                    {lineNumber}.
                  </div>
                ))}
              </div>
            </div>
            <textarea
              value={excludeDomains}
              onChange={(event) => {
                setExcludeDomains(event.target.value);
                localStorage.setItem("exclude_domains", event.target.value);
              }}
              onScroll={(event) => setExcludeScrollTop(event.currentTarget.scrollTop)}
              wrap="off"
              className="h-full min-w-0 flex-1 resize-none overflow-auto bg-transparent px-4 py-3 font-mono text-sm leading-5 text-white outline-none placeholder:text-muted/60"
              placeholder={"wikipedia.org\nreddit.com"}
              spellCheck={false}
            />
          </div>

          <label className="mt-4 block text-sm font-semibold">Google Dorks (tối đa 10)</label>
          <div className="mt-2 flex h-36 overflow-hidden rounded-lg border border-emerald-500/20 bg-panel2 font-mono text-sm shadow-inner shadow-black/20 transition-all focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/25">
            <div className="w-12 shrink-0 select-none overflow-hidden border-r border-emerald-500/15 bg-black/20 px-2 py-3 text-right text-xs font-semibold leading-5 text-emerald-300/80">
              <div style={{ transform: `translateY(-${dorkScrollTop}px)` }}>
                {dorkLineNumbers.map((lineNumber) => (
                  <div key={lineNumber} className="h-5 leading-5">
                    {lineNumber}.
                  </div>
                ))}
              </div>
            </div>
            <textarea
              value={dorks}
              onChange={(event) => setDorks(event.target.value.split(/\r?\n/).slice(0, 10).join("\n"))}
              onScroll={(event) => setDorkScrollTop(event.currentTarget.scrollTop)}
              wrap="off"
              className="h-full min-w-0 flex-1 resize-none overflow-auto bg-transparent px-4 py-3 font-mono text-sm leading-5 text-white outline-none placeholder:text-muted/60"
              spellCheck={false}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Button onClick={startJob} disabled={isPending || isJobActive} className="min-w-40">
              {isPending ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              Bắt đầu crawl
            </Button>
            {jobId && (job?.status === "running" || job?.status === "paused") && (
              <Button
                variant="ghost"
                onClick={togglePauseJob}
                disabled={isPausing}
                className="min-w-36"
              >
                {isPausing ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : job.status === "paused" ? (
                  <Play size={16} />
                ) : (
                  <Pause size={16} />
                )}
                {job.status === "paused" ? "Tiếp tục" : "Tạm dừng"}
              </Button>
            )}
            {jobId && (!job || isJobActive) && (
              <Button
                variant="danger"
                onClick={stopJob}
                disabled={isCancelling}
                className="min-w-36"
              >
                {isCancelling ? <RefreshCw size={16} className="animate-spin" /> : <Square size={16} />}
                Dừng crawl
              </Button>
            )}
            {job && (
              <div className="text-sm text-muted">
                {job.name ? <span className="font-medium text-white">{job.name}</span> : null}
                {job.name ? " · " : null}
                <span
                  className={
                    job.status === "running"
                      ? "text-primary"
                      : job.status === "paused"
                        ? "text-amber-300"
                      : job.status === "cancelled"
                        ? "text-amber-300"
                        : undefined
                  }
                >
                  {job.status}
                </span>
                {" · "}
                {job.processed_urls}/{job.total_urls} · {progress}%
              </div>
            )}
          </div>
          {error && <div className="mt-4 rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</div>}
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Lich su crawl</h2>
            <Button className="h-8 px-2 text-xs" variant="ghost" onClick={() => void loadHistory().catch((err: Error) => setError(err.message))}>
              <RefreshCw size={14} />
              Lam moi
            </Button>
          </div>
          <div className="mt-6 h-48 overflow-auto rounded-md border border-[#1f2b3a] bg-[#0b111b]">
            {history.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted">Chua co lich su crawl.</div>
            ) : (
              history.map((item) => {
                const itemProgress = item.total_urls > 0 ? Math.round((item.processed_urls / item.total_urls) * 100) : 0;
                return (
                  <div key={item.id} className="border-b border-border/70 px-3 py-3 text-sm last:border-b-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{item.name || `Job ${item.id.slice(0, 8)}`}</p>
                        <p className="mt-1 truncate text-xs text-muted">{formatJobTime(item.created_at)} · {item.dorks.length} dork · max {item.max_urls}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold ${jobStatusClass(item.status)}`}>{item.status}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span>{item.processed_urls}/{item.total_urls} URL</span>
                      <span className="text-primary">OK {item.success_count}</span>
                      <span className="text-red-300">Loi {item.failed_count}</span>
                      <span>{itemProgress}%</span>
                    </div>
                    {item.error ? <p className="mt-2 truncate text-xs text-red-300">{item.error}</p> : null}
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      </section>

      <Panel className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Kết quả ({count})</h2>
            <p className="text-sm text-muted">Tối đa 2000 dòng gần nhất.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm URL / domain / title" className="w-64" />
            <Select value={cms} onChange={(event) => { setCms(event.target.value); setPage(1); }} className="w-36">
              {CMS_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </Select>
            <Select value={registerFilter} onChange={(event) => { setRegisterFilter(event.target.value); setPage(1); }} className="w-40">
              {REGISTER_FILTER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="w-36">
              {STATUS_FILTER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select value={urlDepth} onChange={(event) => { setUrlDepth(event.target.value); setPage(1); }} className="w-44">
  {URL_DEPTH_OPTIONS.map((option) => <option key={option}>{option}</option>)}
</Select>
            <a href={exportUrl}>
              <Button variant="ghost" type="button">
                <Download size={16} /> XLSX
              </Button>
            </a>
            <Button variant="ghost" onClick={deleteSelected} disabled={selected.length === 0} title="Xóa dòng đã chọn">
              <Trash2 size={16} />
            </Button>
          </div>
        </div>

        <div className="mt-7 w-full overflow-x-auto rounded-md border border-border">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead className="bg-[#101722] text-left text-muted">
              <tr>
                <th className="sticky left-0 z-10 w-10 bg-[#101722] px-3 py-3">
                  <input type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])} />
                </th>
                <th className="min-w-[320px] whitespace-nowrap px-3 py-3">URL</th>
                <th className="min-w-[180px] whitespace-nowrap px-3 py-3">Domain</th>
                <th className="min-w-[120px] whitespace-nowrap px-3 py-3">Register</th>
                <th className="min-w-[100px] whitespace-nowrap px-3 py-3">CMS</th>
                <th className="max-w-[250px] w-[250px] px-3 py-3">Emails</th>
                <th className="max-w-[200px] w-[200px] px-3 py-3">Phones</th>
                <th className="min-w-[90px] whitespace-nowrap px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="h-20 text-center text-muted">Chưa có dữ liệu.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="sticky left-0 z-10 bg-panel px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))}
                      />
                    </td>
                    <td className="min-w-[320px] whitespace-nowrap px-3 py-3">
                      <div className="font-medium">{row.url}</div>
                      <div className="text-xs text-muted">{row.title ?? "-"}</div>
                    </td>
                    <td className="min-w-[180px] whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-300">{row.domain}</td>
                    <td className="min-w-[120px] whitespace-nowrap px-3 py-3">
                      <AuthLinkCell row={row} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{row.cms_type}</td>
                    <td className="px-3 py-3 align-top text-muted">
                      <div className="max-w-[250px] break-words [overflow-wrap:anywhere]">
                        {values(row.emails)}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-muted">
                      <div className="max-w-[200px]">
                        <ContactLines items={row.phones} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className={row.status === "success" ? "text-primary" : "text-red-300"}>{row.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 text-sm text-muted">
          <Button variant="ghost" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>Trước</Button>
          <span>Trang {page}/{totalPages}</span>
          <Button variant="ghost" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>Sau</Button>
        </div>
      </Panel>
    </>
  );
}
