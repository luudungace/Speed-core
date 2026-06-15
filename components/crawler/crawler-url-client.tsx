"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, ExternalLink, Play, RefreshCw, RotateCcw, Square, Trash2 } from "lucide-react";
import { cancelCrawlJobAction, recrawlResultsAction, startCrawlJobAction } from "@/app/crawler-url/actions";
import { CrawlerColumnPicker } from "@/components/crawler/crawler-column-picker";
import { Button, Input, Panel, Select, Textarea } from "@/components/ui";
import type { CrawlJobRow, CrawlLogRow, CrawlResultRow } from "@/lib/types/crawler";
import { getBacklinkCandidateFromRaw, type BacklinkCandidate } from "@/lib/utils/backlink-candidate";
import {
  CRAWLER_RESULT_COLUMN_STORAGE_KEY,
  CRAWLER_RESULT_COLUMNS,
  contactValues,
  defaultVisibleColumnIds,
  parseStoredVisibleColumns,
  type CrawlerResultColumnId,
} from "@/lib/utils/crawler-result-columns";
import {
  buildCrawlerResultsQueryParams,
  loadCrawlerUrlViewState,
  saveCrawlerUrlViewState,
  type CrawlerUrlViewState,
} from "@/lib/utils/crawler-url-view-state";
import { URL_DEPTH_OPTIONS, type UrlDepthFilter } from "@/lib/utils/forum-url-filter";
import { getManualReviewReason } from "@/lib/utils/manual-review";

const DEFAULT_DORKS = [
  'intitle:"forum" ("register" OR "sign up") ("post thread" OR "submit thread")',
  'inurl:register "forum" ("post a thread" OR "new thread")',
  '"powered by xenforo" ("register" OR "sign up")',
  '"powered by vBulletin" ("register" OR "new posts")',
  '"powered by phpBB" ("register" OR "post a new topic")',
  '("sign up" OR "create account") ("profile" OR "bio") ("website" OR "link")',
  '("register" OR "create account") ("submit article" OR "write for us")',
  '("sign up" OR "join") ("submit your site" OR "add website")',
  '("create account" OR "sign up") ("post" OR "publish") ("community" OR "social")',
  '("register" OR "sign up") ("website URL" OR "profile link" OR "homepage")',
].join("\n");
const DEFAULT_BACKLINK_TARGETS = "coindesk.com\ncointelegraph.com";
const DEFAULT_PAGES_PER_DORK = 2;
const PAGE_SIZE = 10;
const CRAWL_SOURCE_TABS = ["Google Dork", "Backlink"] as const;

function externalUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^\/+/, "")}`;
}

function resultStatusLabel(row: CrawlResultRow) {
  if (row.status === "success") return "Đã đăng ký";
  return "--";
}

function candidateRating(candidate: BacklinkCandidate) {
  const hasForumPostingUrl = candidate.evidence.includes("forum posting URL found");
  if (hasForumPostingUrl && candidate.score >= 70) return "Ngon";
  if (candidate.score >= 55) return "Có tiềm năng";
  if (candidate.score >= 30) return "Xem xét";
  return "Không có tiềm năng";
}

function loadVisibleColumnsFromStorage() {
  if (typeof window === "undefined") return new Set(defaultVisibleColumnIds());
  const stored = parseStoredVisibleColumns(window.localStorage.getItem(CRAWLER_RESULT_COLUMN_STORAGE_KEY));
  return new Set(stored ?? defaultVisibleColumnIds());
}

function renderResultColumnCell(
  columnId: CrawlerResultColumnId,
  row: CrawlResultRow,
  candidate: BacklinkCandidate | null,
) {
  switch (columnId) {
    case "url":
      return (
        <>
          <a
            href={externalUrl(row.url)}
            target="_blank"
            rel="noreferrer"
            className="block truncate font-medium text-white underline-offset-2 hover:text-primary hover:underline"
            title={row.url}
          >
            {row.url}
          </a>
          {row.title ? (
            <div className="truncate text-xs text-muted" title={row.title}>
              {row.title}
            </div>
          ) : null}
        </>
      );
    case "domain":
      return (
        <span className="block truncate font-medium text-white" title={row.domain}>
          {row.domain}
        </span>
      );
    case "rating":
      return candidate ? (
        <span
          className={candidate.is_candidate ? "block truncate font-semibold text-primary" : "block truncate text-muted"}
          title={candidate.evidence.join(", ") || candidate.note}
        >
          {candidateRating(candidate)} · {candidate.score}
        </span>
      ) : (
        <span className="text-muted">Recrawl needed</span>
      );
    case "siteType":
      return candidate ? (
        <span className="block truncate font-medium text-white" title={candidate.evidence.join(", ") || candidate.note}>
          {candidate.site_type}
        </span>
      ) : (
        <span className="text-muted">-</span>
      );
    case "cms":
      return (
        <span className="block truncate" title={row.cms_type}>
          {row.cms_type}
        </span>
      );
    case "emails": {
      const value = contactValues(row.emails);
      return value ? (
        <span className="block truncate" title={value}>
          {value}
        </span>
      ) : (
        <span className="text-muted">-</span>
      );
    }
    case "phones": {
      const value = contactValues(row.phones);
      return value ? (
        <span className="block truncate" title={value}>
          {value}
        </span>
      ) : (
        <span className="text-muted">-</span>
      );
    }
    case "status": {
      const label = resultStatusLabel(row);
      return (
        <span
          className={`block truncate ${row.status === "success" ? "font-medium text-primary" : "text-muted"}`}
          title={row.status === "success" ? "Crawl thành công" : row.error ?? "Crawl thất bại"}
        >
          {label}
        </span>
      );
    }
    default:
      return null;
  }
}

export function CrawlerUrlClient() {
  const [jobName, setJobName] = useState("");
  const [dorks, setDorks] = useState(DEFAULT_DORKS);
  const [maxUrls, setMaxUrls] = useState(50);
  const [backlinkTargets, setBacklinkTargets] = useState(DEFAULT_BACKLINK_TARGETS);
  const [backlinkSourceLimit, setBacklinkSourceLimit] = useState(50);
  const [crawlTab, setCrawlTab] = useState<(typeof CRAWL_SOURCE_TABS)[number]>("Google Dork");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<CrawlJobRow | null>(null);
  const [logs, setLogs] = useState<CrawlLogRow[]>([]);
  const [rows, setRows] = useState<CrawlResultRow[]>([]);
  const [manualRows, setManualRows] = useState<CrawlResultRow[]>([]);
  const [manualCount, setManualCount] = useState(0);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [urlDepth, setUrlDepth] = useState<UrlDepthFilter>("all");
  const [resultJobId, setResultJobId] = useState<string | null>(null);
  const [viewStateLoaded, setViewStateLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [manualPage, setManualPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<CrawlerResultColumnId>>(() => new Set(defaultVisibleColumnIds()));
  const [columnsLoaded, setColumnsLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isCancelling, startCancelTransition] = useTransition();

  const isJobActive = job?.status === "running" || job?.status === "queued";
  const activeResultColumns = useMemo(
    () => CRAWLER_RESULT_COLUMNS.filter((column) => !column.hidden && visibleColumns.has(column.id)),
    [visibleColumns],
  );
  const resultTableColSpan = 1 + activeResultColumns.length;

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const manualTotalPages = Math.max(1, Math.ceil(manualCount / PAGE_SIZE));
  const progress = useMemo(() => {
    if (!job || job.total_urls === 0) return 0;
    return Math.round((job.processed_urls / job.total_urls) * 100);
  }, [job]);
  function currentViewState(override?: Partial<CrawlerUrlViewState>): CrawlerUrlViewState {
    return {
      search: override?.search ?? search,
      urlDepth: override?.urlDepth ?? urlDepth,
      cms: "All CMS",
      jobId: override?.jobId !== undefined ? override.jobId : resultJobId,
      registerFilter: "all",
    };
  }

  async function loadResults(override?: { page?: number; search?: string; urlDepth?: UrlDepthFilter }) {
    const params = buildCrawlerResultsQueryParams(currentViewState(override), {
      page: override?.page ?? page,
      pageSize: PAGE_SIZE,
    });
    const response = await fetch(`/api/crawler/results?${params.toString()}`);
    const data = (await response.json()) as { rows: CrawlResultRow[]; count: number; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Không tải được kết quả.");
    setRows(data.rows);
    setCount(data.count);
    setSelected([]);
  }

  async function loadManualReviewResults(override?: { page?: number; search?: string }) {
    const params = new URLSearchParams({
      page: String(override?.page ?? manualPage),
      pageSize: String(PAGE_SIZE),
      search: override?.search ?? search,
    });
    const response = await fetch(`/api/crawler/manual-review?${params.toString()}`);
    const data = (await response.json()) as { rows: CrawlResultRow[]; count: number; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Không tải được danh sách cần kiểm tra.");
    setManualRows(data.rows);
    setManualCount(data.count);
  }

  useEffect(() => {
    setVisibleColumns(loadVisibleColumnsFromStorage());
    setColumnsLoaded(true);
    const storedViewState = loadCrawlerUrlViewState();
    setSearch(storedViewState.search);
    setUrlDepth(storedViewState.urlDepth);
    setResultJobId(storedViewState.jobId);
    setViewStateLoaded(true);
  }, []);

  useEffect(() => {
    if (!columnsLoaded) return;
    window.localStorage.setItem(CRAWLER_RESULT_COLUMN_STORAGE_KEY, JSON.stringify([...visibleColumns]));
  }, [visibleColumns, columnsLoaded]);

  useEffect(() => {
    if (!viewStateLoaded) return;
    saveCrawlerUrlViewState(currentViewState());
  }, [search, urlDepth, resultJobId, viewStateLoaded]);

  useEffect(() => {
    if (!viewStateLoaded) return;
    void loadResults().catch((err: Error) => setError(err.message));
  }, [page, urlDepth, resultJobId, viewStateLoaded]);

  useEffect(() => {
    void loadManualReviewResults().catch((err: Error) => setError(err.message));
  }, [manualPage]);

  useEffect(() => {
    if (!viewStateLoaded) return;
    const timer = window.setTimeout(() => {
      setPage(1);
      setManualPage(1);
      void loadResults({ page: 1, search }).catch((err: Error) => setError(err.message));
      void loadManualReviewResults({ page: 1, search }).catch((err: Error) => setError(err.message));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, viewStateLoaded]);

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/crawler/jobs/${jobId}`);
      const data = (await response.json()) as { job: CrawlJobRow; logs: CrawlLogRow[] };
      if (response.ok) {
        setJob(data.job);
        setLogs(data.logs);
        await loadResults();
        await loadManualReviewResults();
        if (["completed", "failed", "cancelled"].includes(data.job.status)) window.clearInterval(timer);
      }
    }, 1800);
    return () => window.clearInterval(timer);
  }, [jobId, page, manualPage, search, urlDepth, resultJobId]);

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
      }
    });
  }

  function startJob(source: "serper" | "backlinks") {
    setError(null);
    startTransition(async () => {
      const result = await startCrawlJobAction({
        dorks: source === "serper" ? dorks : "",
        pagesPerDork: DEFAULT_PAGES_PER_DORK,
        name: jobName,
        maxUrls,
        excludeDomains: "",
        backlinkTargets: source === "backlinks" ? backlinkTargets : "",
        backlinkSourceLimit,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setJobId(result.jobId);
      setResultJobId(result.jobId);
      setPage(1);
      const response = await fetch(`/api/crawler/jobs/${result.jobId}`);
      const data = (await response.json()) as { job: CrawlJobRow; logs: CrawlLogRow[] };
      if (response.ok) {
        setJob(data.job);
        setLogs(data.logs);
      } else {
        setLogs([]);
      }
    });
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

  function recrawlSelected() {
    if (selected.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await recrawlResultsAction({
        ids: selected,
        name: `Recrawl ${selected.length} URL`,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setJobId(result.jobId);
      setResultJobId(result.jobId);
      setPage(1);
      const response = await fetch(`/api/crawler/jobs/${result.jobId}`);
      const data = (await response.json()) as { job: CrawlJobRow; logs: CrawlLogRow[] };
      if (response.ok) {
        setJob(data.job);
        setLogs(data.logs);
      } else {
        setLogs([]);
      }
    });
  }

  const exportUrl = `/api/crawler/export?${buildCrawlerResultsQueryParams(currentViewState()).toString()}`;

  return (
    <>
      <section className="grid gap-4 min-h-[700px] xl:grid-cols-[minmax(0,1fr)_514px]">
        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-semibold">Tên dự án</label>
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
              <p className="mt-1 text-xs text-muted">Giới hạn số URL thực sự crawl sau khi tìm nguồn (2000).</p>
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <div className="inline-flex rounded-md bg-[#162130] p-1">
              {CRAWL_SOURCE_TABS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCrawlTab(item)}
                  className={`rounded px-4 py-1.5 text-sm font-semibold ${
                    crawlTab === item ? "bg-[#070c14] text-white" : "text-muted"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            {crawlTab === "Google Dork" ? (
              <div className="mt-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold">Google Dorks</h3>
                    <p className="mt-0.5 text-xs text-muted">Tối đa 10 dork. Hệ thống tìm URL qua Serper rồi crawl từng trang.</p>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => setDorks(DEFAULT_DORKS)} title="Khôi phục dork mặc định">
                    <RotateCcw size={16} /> Mặc định
                  </Button>
                </div>
                <Textarea
                  value={dorks}
                  onChange={(event) => setDorks(event.target.value.split(/\r?\n/).slice(0, 10).join("\n"))}
                  className="mt-3 h-60 w-full"
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    onClick={() => startJob("serper")}
                    disabled={isPending || isJobActive}
                    className="min-w-44"
                    title="Crawl qua Serper"
                  >
                    {isPending ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                    Bắt đầu crawl
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <div>
                  <h3 className="text-sm font-semibold">Competitor Backlinks</h3>
                  <p className="mt-0.5 text-xs text-muted">
                    Mỗi dòng một competitor domain. Hệ thống lấy referring domains active từ backlinks.sh rồi crawl các nguồn đó.
                  </p>
                </div>
                <Textarea
                  value={backlinkTargets}
                  onChange={(event) => setBacklinkTargets(event.target.value)}
                  className="mt-3 h-24 w-full font-mono text-xs"
                  placeholder={"coindesk.com\ncointelegraph.com"}
                />
                <label className="mt-3 block text-sm font-semibold">Số source / competitor</label>
                <Input
                  type="number"
                  min={10}
                  max={1000}
                  value={backlinkSourceLimit}
                  onChange={(event) =>
                    setBacklinkSourceLimit(Math.max(10, Math.min(1000, Number(event.target.value) || 100)))
                  }
                  className="mt-2 w-full"
                />
                <p className="mt-1 text-xs text-muted">Số source domain lấy từ backlinks.sh cho mỗi competitor (10–1000).</p>
                <div className="mt-3 flex justify-end">
                  <Button
                    onClick={() => startJob("backlinks")}
                    disabled={isPending || isJobActive}
                    className="min-w-44"
                    title="Crawl qua backlinks.sh"
                  >
                    {isPending ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                    Bắt đầu crawl
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
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
          <h2 className="text-base font-semibold">Live log</h2>
          <div className="mt-6 h-48 overflow-auto rounded-md border border-[#1f2b3a] bg-[#0b111b] p-3 font-mono text-xs text-slate-300">
            {logs.length === 0 ? (
              <div>Chưa có log.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className={log.level === "error" ? "text-red-300" : "text-slate-300"}>
                  [{new Date(log.created_at).toLocaleTimeString("vi-VN")}] {log.message}
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
 <Panel className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Kết quả ({count})</h2>
            <p className="text-sm text-muted">Hiển thị 10 dòng mỗi trang.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm URL / domain / title" className="w-64" />
            <Select
              value={urlDepth}
              onChange={(event) => {
                setUrlDepth(event.target.value as UrlDepthFilter);
                setPage(1);
              }}
              className="min-w-[190px]"
              title="Lọc độ sâu URL"
            >
              {URL_DEPTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            {resultJobId ? (
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setResultJobId(null);
                  setPage(1);
                }}
                title="Đang lọc theo job hiện tại — bấm để xem tất cả job"
              >
                Job hiện tại ×
              </Button>
            ) : null}
            <CrawlerColumnPicker visibleColumns={visibleColumns} onChange={setVisibleColumns} />
            <a href={exportUrl}>
              <Button variant="ghost" type="button">
                <Download size={16} /> XLSX
              </Button>
            </a>
            <Button
              variant="ghost"
              onClick={recrawlSelected}
              disabled={selected.length === 0 || isPending || isJobActive}
              title="Recrawl URL da chon"
            >
              {isPending ? <RefreshCw size={16} className="animate-spin" /> : <RotateCcw size={16} />}
              Recrawl
            </Button>
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
                {activeResultColumns.map((column) => (
                  <th
                    key={column.id}
                    className={`whitespace-nowrap px-3 py-3 ${
                      column.id === "url" ? "min-w-[280px]" : column.id === "domain" ? "min-w-[160px]" : "min-w-[120px]"
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={resultTableColSpan} className="h-20 text-center text-muted">Chưa có dữ liệu.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const candidate = getBacklinkCandidateFromRaw(row.raw_serper_data);

                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="sticky left-0 z-10 bg-panel px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(row.id)}
                          onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))}
                        />
                      </td>
                      {activeResultColumns.map((column) => (
                        <td key={column.id} className="max-w-[320px] px-3 py-3">
                          {renderResultColumnCell(column.id, row, candidate)}
                        </td>
                      ))}
                    </tr>
                  );
                })
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
      <Panel className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Cần kiểm tra thủ công ({manualCount})</h2>
            <p className="text-sm text-muted">CAPTCHA, Cloudflare, login wall hoặc trang chặn bot. Hiển thị 10 dòng mỗi trang.</p>
          </div>
        </div>

        <div className="mt-4 w-full overflow-x-auto rounded-md border border-border">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead className="bg-[#101722] text-left text-muted">
              <tr>
                <th className="min-w-[320px] whitespace-nowrap px-3 py-3">URL</th>
                <th className="min-w-[140px] whitespace-nowrap px-3 py-3">Lý do</th>
                <th className="min-w-[120px] whitespace-nowrap px-3 py-3">Mở</th>
              </tr>
            </thead>
            <tbody>
              {manualRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="h-20 text-center text-muted">Chưa có URL cần kiểm tra thủ công.</td>
                </tr>
              ) : (
                manualRows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="min-w-[320px] whitespace-nowrap px-3 py-3">
                      <a
                        href={externalUrl(row.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-white underline-offset-2 hover:text-primary hover:underline"
                      >
                        {row.url}
                      </a>
                      <div className="text-xs text-muted">{row.title ?? row.domain}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-amber-300">{getManualReviewReason(row.error) ?? "Blocked"}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <a href={externalUrl(row.url)} target="_blank" rel="noreferrer">
                        <Button variant="ghost" type="button">
                          <ExternalLink size={16} /> Mở
                        </Button>
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 text-sm text-muted">
          <Button variant="ghost" onClick={() => setManualPage((value) => Math.max(1, value - 1))} disabled={manualPage <= 1}>
            Trước
          </Button>
          <span>
            Trang {manualPage}/{manualTotalPages}
          </span>
          <Button
            variant="ghost"
            onClick={() => setManualPage((value) => Math.min(manualTotalPages, value + 1))}
            disabled={manualPage >= manualTotalPages}
          >
            Sau
          </Button>
        </div>
      </Panel>

     
    </>
  );
}
