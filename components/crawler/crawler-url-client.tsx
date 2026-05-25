"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, Play, RefreshCw, Square, Trash2 } from "lucide-react";
import { cancelCrawlJobAction, startCrawlJobAction } from "@/app/crawler-url/actions";
import { Button, Input, Panel, Select, Textarea } from "@/components/ui";
import type { ContactItem, CrawlJobRow, CrawlLogRow, CrawlResultRow } from "@/lib/types/crawler";

const DEFAULT_DORKS = 'intitle:"forum" "register" "submit a thread"\nsite:*.org "powered by xenforo"';
const DEFAULT_EXCLUDE = "wikipedia.org\nreddit.com\nquora.com";
const CMS_OPTIONS = ["All CMS", "XenForo", "WordPress", "vBulletin", "phpBB", "Unknown"];

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

export function CrawlerUrlClient() {
  const [jobName, setJobName] = useState("");
  const [dorks, setDorks] = useState(DEFAULT_DORKS);
  const [pagesPerDork, setPagesPerDork] = useState(2);
  const [maxUrls, setMaxUrls] = useState(500);
  const [excludeDomains, setExcludeDomains] = useState(DEFAULT_EXCLUDE);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<CrawlJobRow | null>(null);
  const [logs, setLogs] = useState<CrawlLogRow[]>([]);
  const [rows, setRows] = useState<CrawlResultRow[]>([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [cms, setCms] = useState("All CMS");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCancelling, startCancelTransition] = useTransition();

  const isJobActive = job?.status === "running" || job?.status === "queued";

  const totalPages = Math.max(1, Math.ceil(count / 20));
  const progress = useMemo(() => {
    if (!job || job.total_urls === 0) return 0;
    return Math.round((job.processed_urls / job.total_urls) * 100);
  }, [job]);

  async function loadResults() {
    const params = new URLSearchParams({ page: String(page), pageSize: "20", search, cms });
    const response = await fetch(`/api/crawler/results?${params.toString()}`);
    const data = (await response.json()) as { rows: CrawlResultRow[]; count: number; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Không tải được kết quả.");
    setRows(data.rows);
    setCount(data.count);
    setSelected([]);
  }

  useEffect(() => {
    void loadResults().catch((err: Error) => setError(err.message));
  }, [page, cms]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      void loadResults().catch((err: Error) => setError(err.message));
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
        if (["completed", "failed", "cancelled"].includes(data.job.status)) window.clearInterval(timer);
      }
    }, 1800);
    return () => window.clearInterval(timer);
  }, [jobId, page, search, cms]);

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

  const exportUrl = `/api/crawler/export?${new URLSearchParams({ search, cms }).toString()}`;

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
          <p className="mt-0.5 text-xs text-muted">Mỗi dòng một domain (tối đa 50). Khớp cả subdomain.</p>
          <Textarea
            value={excludeDomains}
            onChange={(event) => setExcludeDomains(event.target.value)}
            className="mt-2 h-24 w-full font-mono text-xs"
            placeholder={"wikipedia.org\nreddit.com"}
          />

          <label className="mt-4 block text-sm font-semibold">Google Dorks (tối đa 10)</label>
          <Textarea
            value={dorks}
            onChange={(event) => setDorks(event.target.value.split(/\r?\n/).slice(0, 10).join("\n"))}
            className="mt-2 h-36 w-full"
          />

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Button onClick={startJob} disabled={isPending || isJobActive} className="min-w-40">
              {isPending ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              Bắt đầu crawl
            </Button>
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
            <p className="text-sm text-muted">Tối đa 2000 dòng gần nhất.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm URL / domain / title" className="w-64" />
            <Select value={cms} onChange={(event) => { setCms(event.target.value); setPage(1); }} className="w-36">
              {CMS_OPTIONS.map((option) => <option key={option}>{option}</option>)}
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
                <th className="min-w-[100px] whitespace-nowrap px-3 py-3">CMS</th>
                <th className="max-w-[250px] w-[250px] px-3 py-3">Emails</th>
                <th className="max-w-[200px] w-[200px] px-3 py-3">Phones</th>
                <th className="min-w-[90px] whitespace-nowrap px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="h-20 text-center text-muted">Chưa có dữ liệu.</td>
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
                      <div className="text-xs text-muted">{row.title ?? row.domain}</div>
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
