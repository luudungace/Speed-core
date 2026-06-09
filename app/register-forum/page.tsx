"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, RefreshCw, Trash2, Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Panel } from "@/components/ui";
import type { RegistrationJobRow } from "@/lib/types/registration";

interface CandidateRow {
  id: string;
  url: string;
  cms_type: string;
  domain: string;
  title: string | null;
}

export default function RegisterForumPage() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [candidatesCount, setCandidatesCount] = useState(0);
  const [candidatesPage, setCandidatesPage] = useState(1);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);

  const [jobs, setJobs] = useState<RegistrationJobRow[]>([]);
  const [jobsCount, setJobsCount] = useState(0);
  const [jobsPage, setJobsPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [workerStatus, setWorkerStatus] = useState<"idle" | "starting" | "started" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  // --- FETCHERS ---

  async function fetchCandidates() {
    try {
      const res = await fetch(`/api/registration/candidates?page=${candidatesPage}&pageSize=8`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.rows);
        setCandidatesCount(data.count);
      }
    } catch (err) {
      console.error("Lỗi khi tải ứng viên diễn đàn:", err);
    }
  }

  async function fetchJobs() {
    try {
      const res = await fetch(`/api/registration/jobs?page=${jobsPage}&pageSize=8&isDirect=false${statusFilter ? `&status=${statusFilter}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.rows);
        setJobsCount(data.count);
      }
    } catch (err) {
      console.error("Lỗi khi tải hàng đợi job:", err);
    }
  }

  // Load datasets
  useEffect(() => {
    void fetchCandidates();
  }, [candidatesPage]);

  useEffect(() => {
    void fetchJobs();
  }, [jobsPage, statusFilter]);

  // Dynamic poll queue updates every 5 seconds to track active workers
  useEffect(() => {
    const timer = window.setInterval(fetchJobs, 5000);
    return () => window.clearInterval(timer);
  }, [jobsPage, statusFilter]);

  // Enqueue selected candidate URLs
  function handleEnqueue() {
    if (selectedCandidates.length === 0) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/registration/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: selectedCandidates }),
        });
        const data = await res.json();
        if (res.ok) {
          setSuccess(`Đã thêm thành công ${data.count} diễn đàn vào hàng đợi đăng ký.`);
          setSelectedCandidates([]);
          setCandidatesPage(1);
          setJobsPage(1);
          await Promise.all([fetchCandidates(), fetchJobs()]);
        } else {
          setError(data.error || "Gặp lỗi khi enqueue đăng ký.");
        }
      } catch (err) {
        setError("Lỗi kết nối.");
      }
    });
  }

  // Delete a registration job
  function handleDeleteJob(id: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/registration/jobs?id=${id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (res.ok) {
          setSuccess("Đã xóa job đăng ký thành công khỏi hàng đợi.");
          await fetchJobs();
        } else {
          setError(data.error || "Gặp lỗi khi xóa job.");
        }
      } catch (err) {
        setError("Lỗi kết nối.");
      }
    });
  }

  // Confirm manual registration is completed for a job
  function handleConfirmManualDone(id: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/registration/jobs?id=${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "manual_done" }),
        });
        const data = await res.json();
        if (res.ok) {
          setSuccess("Đã xác nhận hoàn thành đăng ký thủ công. Worker sẽ tiếp tục xử lý.");
          await fetchJobs();
        } else {
          setError(data.error || "Gặp lỗi khi gửi xác nhận.");
        }
      } catch (err) {
        setError("Lỗi kết nối.");
      }
    });
  }

  // Start registration worker
  function handleStartWorker() {
    setWorkerStatus("starting");
    startTransition(async () => {
      try {
        const res = await fetch("/api/worker/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "register" }),
        });
        const data = await res.json();
        if (res.ok) {
          setWorkerStatus("started");
          setTimeout(() => setWorkerStatus("idle"), 5000);
        } else {
          setWorkerStatus("error");
          setError(data.error || "Lỗi khi khởi động worker.");
          setTimeout(() => setWorkerStatus("idle"), 3000);
        }
      } catch (err) {
        setWorkerStatus("error");
        setError("Lỗi kết nối.");
        setTimeout(() => setWorkerStatus("idle"), 3000);
      }
    });
  }

  const totalCandidatePages = Math.max(1, Math.ceil(candidatesCount / 8));
  const totalJobPages = Math.max(1, Math.ceil(jobsCount / 8));

  return (
    <AppShell title="Đăng ký diễn đàn">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal text-white">Đăng ký diễn đàn</h1>
        <p className="text-sm text-muted">
          Quản lý tiến độ: chọn các diễn đàn đã cào và phân tích thành công để đẩy vào hàng đợi đăng ký tài khoản.
        </p>
      </div>

      {/* Form thêm diễn đàn cần đăng ký mới */}
      <div className="mt-6">
        <Panel className="bg-[#0b121f]/90 border-[#1f2d42] p-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Nạp thêm diễn đàn cần đăng ký mới</h2>
              <p className="text-xs text-muted mt-0.5">Nhập URL diễn đàn để hệ thống tự động đăng ký tài khoản mới và đăng bài đi link.</p>
            </div>
            
            {/* Tab selector */}
            <div className="flex rounded-md bg-slate-950 p-0.5 border border-[#1f2d42] shrink-0">
              <button
                type="button"
                onClick={() => { setAddMode("single"); setError(null); setSuccess(null); }}
                className={`rounded px-3 py-1 text-xs font-semibold transition ${
                  addMode === "single" ? "bg-cyan-500/25 text-cyan-400 border border-cyan-500/30" : "text-muted hover:text-white"
                }`}
              >
                Nhập đơn lẻ
              </button>
              <button
                type="button"
                onClick={() => { setAddMode("bulk"); setError(null); setSuccess(null); }}
                className={`rounded px-3 py-1 text-xs font-semibold transition ${
                  addMode === "bulk" ? "bg-cyan-500/25 text-cyan-400 border border-cyan-500/30" : "text-muted hover:text-white"
                }`}
              >
                Nhập hàng loạt (Bulk)
              </button>
            </div>
          </div>
          
          {addMode === "single" ? (
            <form onSubmit={(e) => {
              e.preventDefault();
              const target = e.currentTarget;
              const formData = new FormData(target);
              const url = formData.get("url") as string;
              const cmsType = formData.get("cmsType") as string;

              if (!url || !cmsType) {
                setError("Vui lòng điền đầy đủ URL và loại CMS.");
                return;
              }

              setError(null);
              setSuccess(null);
              
              startTransition(async () => {
                try {
                  const res = await fetch("/api/registration/jobs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url, cmsType }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setSuccess("Đã nạp diễn đàn thành công vào hàng đợi đăng ký tài khoản mới.");
                    target.reset();
                    setJobsPage(1);
                    await fetchJobs();
                  } else {
                    setError(data.error || "Gặp lỗi khi nạp diễn đàn.");
                  }
                } catch (err) {
                  setError("Lỗi kết nối.");
                }
              });
            }} className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 items-end">
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <label className="text-xs text-slate-300 font-medium">Địa chỉ diễn đàn (URL)</label>
                <input
                  type="url"
                  name="url"
                  required
                  placeholder="https://diendan.com"
                  className="h-9 rounded-md border border-[#1f2b3a] bg-[#0d141d] px-3 text-sm text-white outline-none placeholder:text-muted focus:border-primary/70"
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-300 font-medium">Loại CMS</label>
                <select
                  name="cmsType"
                  required
                  className="h-9 rounded-md border border-[#1f2b3a] bg-[#0d141d] px-3 text-sm text-white outline-none focus:border-primary/70"
                >
                  <option value="XenForo">XenForo</option>
                  <option value="WordPress">WordPress</option>
                  <option value="phpBB">phpBB</option>
                  <option value="Fallback">Khác (Fallback)</option>
                </select>
              </div>
              
              <div className="sm:col-span-3 lg:col-span-4 flex justify-end">
                <Button type="submit" disabled={isPending} className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white">
                  {isPending ? <RefreshCw size={14} className="animate-spin mr-1.5" /> : null}
                  Kích hoạt Đăng ký &amp; Đi link
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={(e) => {
              e.preventDefault();
              const target = e.currentTarget;
              const formData = new FormData(target);
              const bulkText = formData.get("bulkText") as string;
              const defaultCmsType = formData.get("defaultCmsType") as string;

              if (!bulkText.trim()) {
                setError("Vui lòng nhập danh sách URL.");
                return;
              }

              setError(null);
              setSuccess(null);

              const lines = bulkText.split("\n");
              const jobs: Array<{ url: string; cmsType: string }> = [];
              
              for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line || line.startsWith("#")) continue;
                
                const parts = line.split(/[|,]/);
                const url = parts[0]?.trim();
                const cmsType = parts[1]?.trim() || defaultCmsType;
                
                if (url) {
                  jobs.push({ url, cmsType });
                }
              }

              if (jobs.length === 0) {
                setError("Không tìm thấy URL hợp lệ nào.");
                return;
              }

              startTransition(async () => {
                try {
                  const res = await fetch("/api/registration/jobs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ jobs }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setSuccess(`Đã nạp hàng loạt thành công ${data.count} diễn đàn vào hàng đợi đăng ký tài khoản mới.`);
                    target.reset();
                    setJobsPage(1);
                    await fetchJobs();
                  } else {
                    setError(data.error || "Gặp lỗi khi nhập hàng loạt.");
                  }
                } catch (err) {
                  setError("Lỗi kết nối.");
                }
              });
            }} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-4 items-end">
                <div className="flex flex-col gap-1.5 sm:col-span-3">
                  <label className="text-xs text-slate-300 font-medium">Danh sách diễn đàn (Mỗi URL trên một dòng)</label>
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-1">
                  <label className="text-xs text-slate-300 font-medium font-semibold text-cyan-400">CMS mặc định</label>
                  <select
                    name="defaultCmsType"
                    required
                    className="h-9 rounded-md border border-[#1f2b3a] bg-[#0d141d] px-3 text-sm text-white outline-none focus:border-primary/70"
                  >
                    <option value="XenForo">XenForo</option>
                    <option value="WordPress">WordPress</option>
                    <option value="phpBB">phpBB</option>
                    <option value="Fallback">Khác (Fallback)</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <textarea
                  name="bulkText"
                  required
                  rows={6}
                  placeholder="https://diendan1.com | XenForo&#10;https://diendan2.com | phpBB&#10;https://diendan3.com"
                  className="rounded-md border border-[#1f2b3a] bg-[#0d141d] p-3 text-sm text-white outline-none placeholder:text-muted/70 focus:border-primary/70 font-mono resize-y"
                />
                <p className="text-[11px] text-muted">
                  * Mỗi URL trên một dòng. Có thể viết kèm CMS phân tách bằng dấu đứng (`|`) hoặc dấu phẩy (`,`). Ví dụ: `https://example.com | phpBB`.
                </p>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isPending} className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white">
                  {isPending ? <RefreshCw size={14} className="animate-spin mr-1.5" /> : null}
                  Kích hoạt Đăng ký hàng loạt &amp; Đi link
                </Button>
              </div>
            </form>
          )}
        </Panel>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-md border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {success}
        </div>
      )}

      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        {/* Candidates Panel */}
        <Panel>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white">Ứng viên đăng ký</h2>
              <p className="text-sm text-muted">URL đã cào và phân loại CMS rõ ràng (chưa enqueue).</p>
            </div>
            <Button
              onClick={handleEnqueue}
              disabled={isPending || selectedCandidates.length === 0}
              className="flex items-center gap-1.5"
            >
              {isPending ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              Enqueue ({selectedCandidates.length})
            </Button>
          </div>

          <div className="mt-6 overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#101722] text-muted font-medium">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={candidates.length > 0 && selectedCandidates.length === candidates.length}
                      onChange={(e) => {
                        setSelectedCandidates(e.target.checked ? candidates.map((c) => c.url) : []);
                      }}
                    />
                  </th>
                  <th className="px-3 py-3">Địa chỉ (Target)</th>
                  <th className="px-3 py-3 w-28">CMS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="h-24 text-center text-muted">
                      Chưa có ứng viên mới (hãy chạy thêm job cào URL).
                    </td>
                  </tr>
                ) : (
                  candidates.map((row) => (
                    <tr key={row.id} className="hover:bg-[#0e1726]/40 transition-colors">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedCandidates.includes(row.url)}
                          onChange={(e) =>
                            setSelectedCandidates((curr) =>
                              e.target.checked ? [...curr, row.url] : curr.filter((u) => u !== row.url)
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-100">
                        <div className="truncate max-w-[280px]" title={row.url}>
                          {row.url}
                        </div>
                        <span className="text-xs text-muted block truncate max-w-[280px]">
                          {row.title || row.domain}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-300 font-semibold">{row.cms_type}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted">
            <Button
              variant="ghost"
              onClick={() => setCandidatesPage((val) => Math.max(1, val - 1))}
              disabled={candidatesPage <= 1}
              className="h-8 px-2.5 text-xs"
            >
              Trước
            </Button>
            <span>
              Trang {candidatesPage}/{totalCandidatePages}
            </span>
            <Button
              variant="ghost"
              onClick={() => setCandidatesPage((val) => Math.min(totalCandidatePages, val + 1))}
              disabled={candidatesPage >= totalCandidatePages}
              className="h-8 px-2.5 text-xs"
            >
              Sau
            </Button>
          </div>
        </Panel>

        {/* Jobs Queue Panel */}
        <Panel>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3 mb-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-semibold text-white">Job queue ({jobsCount})</h2>
              <span className="text-xs text-muted">Auto-refresh (5s)</span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">Lọc:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setJobsPage(1);
                  }}
                  className="h-8 rounded-md border border-[#1f2b3a] bg-[#0c131f] px-2.5 text-xs text-slate-200 outline-none focus:border-cyan-500/70 cursor-pointer"
                >
                  <option value="">Tất cả</option>
                  <option value="success">Thành công</option>
                  <option value="failed">Thất bại</option>
                  <option value="processing">Đang chạy</option>
                  <option value="queued">Đang chờ</option>
                </select>
              </div>

              <button
                onClick={handleStartWorker}
                disabled={isPending || workerStatus === "starting"}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] ${
                  workerStatus === "started"
                    ? "bg-emerald-600/30 border border-emerald-500/40 text-emerald-300"
                    : workerStatus === "error"
                    ? "bg-red-600/30 border border-red-500/40 text-red-300"
                    : "bg-cyan-600 hover:bg-cyan-500 border border-cyan-500/30 text-white shadow-md shadow-cyan-900/20"
                }`}
              >
                {workerStatus === "starting" ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : workerStatus === "started" ? (
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                ) : (
                  <Play size={14} />
                )}
                {workerStatus === "starting"
                  ? "Đang khởi động..."
                  : workerStatus === "started"
                  ? "Worker đang chạy!"
                  : workerStatus === "error"
                  ? "Lỗi khởi động"
                  : "Chạy Worker"}
              </button>
            </div>
          </div>

          <div className="mt-2 overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#101722] text-muted font-medium">
                <tr>
                  <th className="px-3 py-3">Mục tiêu</th>
                  <th className="px-3 py-3 w-28">Trạng thái</th>
                  <th className="px-3 py-3 w-48">Lý do thất bại / Chi tiết</th>
                  <th className="px-3 py-3 w-40">Tài khoản tạo</th>
                  <th className="px-3 py-3 w-16 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center text-muted">
                      Hàng đợi trống.
                    </td>
                  </tr>
                ) : (
                  jobs.map((row) => {
                    const isSemiAuto = row.status === "processing" && row.error?.startsWith("[BÁN TỰ ĐỘNG]");
                    return (
                      <tr key={row.id} className="hover:bg-[#0e1726]/40 transition-colors">
                        <td className="px-3 py-3 font-medium text-slate-100">
                          <div className="truncate max-w-[220px]" title={row.url}>
                            {row.url}
                          </div>
                          <span className="text-xs text-muted block">{row.cms_type}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                              row.status === "success"
                                ? "bg-emerald-950/40 text-emerald-300 border border-emerald-900/40"
                                : row.status === "failed"
                                ? "bg-red-950/40 text-red-300 border border-red-900/40"
                                : isSemiAuto
                                ? "bg-orange-950/50 text-orange-400 border border-orange-500/30 animate-pulse font-bold"
                                : row.status === "processing"
                                ? "bg-amber-950/40 text-amber-300 border border-amber-900/40 animate-pulse"
                                : "bg-slate-900 text-slate-400 border border-slate-800"
                            }`}
                          >
                            {isSemiAuto ? "Bán tự động" : row.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {isSemiAuto ? (
                            <span className="text-orange-400 font-semibold block max-w-[200px] break-words whitespace-normal animate-pulse" title={row.error || undefined}>
                              {row.error}
                            </span>
                          ) : row.error ? (
                            <span className="text-red-400 font-medium block max-w-[200px] break-words whitespace-normal" title={row.error || undefined}>
                              {row.error}
                            </span>
                          ) : row.status === "failed" ? (
                            <span className="text-red-400/70 italic">Thất bại (Không rõ lý do)</span>
                          ) : row.status === "processing" ? (
                            <span className="text-amber-400 animate-pulse">Đang đăng ký &amp; đi link...</span>
                          ) : row.status === "success" ? (
                            <span className="text-emerald-400 font-medium">Thành công</span>
                          ) : (
                            <span className="text-muted italic">Đang chờ...</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-300 text-xs">
                          {row.username ? (
                            <>
                              <div className="font-semibold text-slate-100">{row.username}</div>
                              <div className="text-muted truncate max-w-[150px]">{row.password}</div>
                            </>
                          ) : row.status === "processing" ? (
                            <span className="text-muted italic animate-pulse">đang chạy...</span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {isSemiAuto && (
                              <Button
                                onClick={() => handleConfirmManualDone(row.id)}
                                className="h-7 px-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-md transition-colors"
                                title="Xác nhận đã đăng ký thủ công"
                                disabled={isPending}
                              >
                                Đăng ký xong
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              onClick={() => handleDeleteJob(row.id)}
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-md transition-colors"
                              title="Xóa job"
                              disabled={isPending}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted">
            <Button
              variant="ghost"
              onClick={() => setJobsPage((val) => Math.max(1, val - 1))}
              disabled={jobsPage <= 1}
              className="h-8 px-2.5 text-xs"
            >
              Trước
            </Button>
            <span>
              Trang {jobsPage}/{totalJobPages}
            </span>
            <Button
              variant="ghost"
              onClick={() => setJobsPage((val) => Math.min(totalJobPages, val + 1))}
              disabled={jobsPage >= totalJobPages}
              className="h-8 px-2.5 text-xs"
            >
              Sau
            </Button>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
