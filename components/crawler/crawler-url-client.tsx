"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, ExternalLink, Play, RefreshCw, RotateCcw, Square, Trash2 } from "lucide-react";
import { cancelCrawlJobAction, recrawlResultsAction, startCrawlJobAction } from "@/app/crawler-url/actions";
import { Button, Input, Panel, Textarea } from "@/components/ui";
import type { CrawlJobRow, CrawlLogRow, CrawlResultRow } from "@/lib/types/crawler";
import { getBacklinkCandidateFromRaw, type BacklinkCandidate } from "@/lib/utils/backlink-candidate";
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

function externalUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^\/+/, "")}`;
}

function candidateRating(candidate: BacklinkCandidate) {
  const hasForumPostingUrl = candidate.evidence.includes("forum posting URL found");
  if (hasForumPostingUrl && candidate.score >= 70) return "Ngon";
  if (candidate.score >= 55) return "Có tiềm năng";
  if (candidate.score >= 30) return "Xem xét";
  return "Không có tiềm năng";
}

export function CrawlerUrlClient() {
  const [jobName, setJobName] = useState("");
  const [dorks, setDorks] = useState(DEFAULT_DORKS);
  const [maxUrls, setMaxUrls] = useState(50);
  const [backlinkTargets, setBacklinkTargets] = useState(DEFAULT_BACKLINK_TARGETS);
  const [backlinkSourceLimit, setBacklinkSourceLimit] = useState(50);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<CrawlJobRow | null>(null);
  const [logs, setLogs] = useState<CrawlLogRow[]>([]);
  const [rows, setRows] = useState<CrawlResultRow[]>([]);
  const [manualRows, setManualRows] = useState<CrawlResultRow[]>([]);
  const [manualCount, setManualCount] = useState(0);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCancelling, startCancelTransition] = useTransition();

  const isJobActive = job?.status === "running" || job?.status === "queued";

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const progress = useMemo(() => {
    if (!job || job.total_urls === 0) return 0;
    return Math.round((job.processed_urls / job.total_urls) * 100);
  }, [job]);
  const visibleRows = useMemo(
    () => rows.filter((row) => !getManualReviewReason(row.error)),
    [rows],
  );

  async function loadResults() {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      search,
    });
    const response = await fetch(`/api/crawler/results?${params.toString()}`);
    const data = (await response.json()) as { rows: CrawlResultRow[]; count: number; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Không tải được kết quả.");
    setRows(data.rows);
    setCount(data.count);
    setSelected([]);
  }

  async function loadManualReviewResults() {
    const params = new URLSearchParams({ page: "1", pageSize: String(PAGE_SIZE), search });
    const response = await fetch(`/api/crawler/manual-review?${params.toString()}`);
    const data = (await response.json()) as { rows: CrawlResultRow[]; count: number; error?: string };
    if (!response.ok) throw new Error(data.error ?? "KhÃ´ng táº£i Ä‘Æ°á»£c danh sÃ¡ch cáº§n kiá»ƒm tra.");
    setManualRows(data.rows);
    setManualCount(data.count);
  }

  useEffect(() => {
    void loadResults().catch((err: Error) => setError(err.message));
    void loadManualReviewResults().catch((err: Error) => setError(err.message));
  }, [page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      void loadResults().catch((err: Error) => setError(err.message));
      void loadManualReviewResults().catch((err: Error) => setError(err.message));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

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
  }, [jobId, page, search]);

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

  const exportUrl = `/api/crawler/export?${new URLSearchParams({ search }).toString()}`;

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
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold">Google Dorks</h3>
                <p className="mt-0.5 text-xs text-muted">Tối đa 10 dork. Hệ thống tìm URL qua Serper rồi crawl từng trang.</p>
              </div>
              <Button type="button" variant="ghost" onClick={() => setDorks(DEFAULT_DORKS)} title="Khoi phuc dork mac dinh">
                <RotateCcw size={16} /> Mặc định
              </Button>
            </div>
            <Textarea
              value={dorks}
              onChange={(event) => setDorks(event.target.value.split(/\r?\n/).slice(0, 10).join("\n"))}
              className="mt-3 h-36 w-full"
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={() => startJob("serper")} disabled={isPending || isJobActive} className="min-w-44" title="Crawl Serper">
                {isPending ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                Crawl Google Dork
              </Button>
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <div>
              <h3 className="text-sm font-semibold">Competitor Backlinks</h3>
              <p className="mt-0.5 text-xs text-muted">Mỗi dòng một competitor domain. Hệ thống lấy referring domains active từ backlinks.sh rồi crawl các nguồn đó.</p>
            </div>
            <Textarea
              value={backlinkTargets}
              onChange={(event) => setBacklinkTargets(event.target.value)}
              className="mt-3 h-24 w-full font-mono text-xs"
              placeholder={"coindesk.com\ncointelegraph.com"}
            />
            <label className="mt-3 block text-sm font-semibold">Backlink source / competitor</label>
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
            <p className="mt-1 text-xs text-muted">Số source domain lấy từ backlinks.sh cho mỗi competitor.</p>
            <div className="mt-3 flex justify-end">
              <Button onClick={() => startJob("backlinks")} disabled={isPending || isJobActive} className="min-w-44">
                {isPending ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                Crawl Backlink
              </Button>
            </div>
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
            <h2 className="text-base font-semibold">Cần kiểm tra thủ công ({manualCount})</h2>
            <p className="text-sm text-muted">CAPTCHA, Cloudflare, login wall hoặc trang chặn bot.</p>
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
      </Panel>

      <Panel className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Kết quả ({count})</h2>
            <p className="text-sm text-muted">Hiển thị 10 dòng mỗi trang.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm URL / domain / title" className="w-64" />
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
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-11" />
              <col className="w-[42%]" />
              <col className="w-[30%]" />
              <col className="w-[28%]" />
            </colgroup>
            <thead className="bg-[#101722] text-left text-muted">
              <tr>
                <th className="sticky left-0 z-10 w-10 bg-[#101722] px-3 py-3">
                  <input type="checkbox" checked={visibleRows.length > 0 && selected.length === visibleRows.length} onChange={(event) => setSelected(event.target.checked ? visibleRows.map((row) => row.id) : [])} />
                </th>
                <th className="px-3 py-3">URL</th>
                <th className="px-3 py-3">Đánh giá</th>
                <th className="px-3 py-3">Loại trang</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="h-20 text-center text-muted">Chưa có dữ liệu.</td>
                </tr>
              ) : (
                visibleRows.map((row) => {
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
                      <td className="px-3 py-3">
                        <a
                          href={externalUrl(row.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate font-medium text-white underline-offset-2 hover:text-primary hover:underline"
                          title={row.url}
                        >
                          {row.url}
                        </a>
                        <div className="truncate text-xs text-muted" title={row.title ?? row.domain}>{row.title ?? row.domain}</div>
                      </td>
                      <td className="px-3 py-3">
                        {candidate ? (
                          <div>
                            <span
                              className={candidate.is_candidate ? "block truncate font-semibold text-primary" : "block truncate text-muted"}
                              title={candidate.evidence.join(", ") || candidate.note}
                            >
                              {candidateRating(candidate)} · {candidate.score}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted">Recrawl needed</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {candidate ? (
                          <div>
                            <span className="block truncate font-medium text-white" title={candidate.evidence.join(", ") || candidate.note}>
                              {candidate.site_type}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
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
    </>
  );
}
