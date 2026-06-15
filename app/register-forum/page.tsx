"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, RefreshCw, Trash2, Play, AlertTriangle, ExternalLink, Lock, Check, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Panel } from "@/components/ui";
import type { RegistrationJobRow } from "@/lib/types/registration";

interface CandidateRow {
  id: string;
  url: string;
  cms_type: string;
  domain: string;
  title: string | null;
  registered?: boolean;
  jobId?: string | null;
  username?: string | null;
  password?: string | null;
  jobStatus?: string | null;
  jobError?: string | null;
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

  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [inputUsername, setInputUsername] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [unregisteredCount, setUnregisteredCount] = useState(0);
  const [registeredCount, setRegisteredCount] = useState(0);

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
      const res = await fetch(`/api/registration/jobs?page=${jobsPage}&pageSize=8${statusFilter ? `&status=${statusFilter}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.rows);
        setJobsCount(data.count);
        setUnregisteredCount(data.unregisteredCount ?? 0);
        setRegisteredCount(data.registeredCount ?? 0);
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

  // Get standardized registration URL based on forum URL and CMS type
  function getRegisterUrl(url: string, cmsType: string): string {
    try {
      let base = url.trim();
      if (!base.startsWith("http://") && !base.startsWith("https://")) {
        base = "https://" + base;
      }
      const urlObj = new URL(base);
      const origin = urlObj.origin;
      
      switch (cmsType) {
        case "XenForo":
          return `${origin}/register/`;
        case "WordPress":
          return `${origin}/wp-login.php?action=register`;
        case "phpBB":
          return `${origin}/ucp.php?mode=register`;
        default:
          return base; // Fallback to homepage
      }
    } catch (e) {
      return url;
    }
  }

  // Save manual registration credentials to the job or candidate
  function handleSaveCredentials(id: string | null, url: string, cmsType: string) {
    if (!inputUsername.trim() || !inputPassword.trim()) {
      setError("Vui lòng điền đầy đủ cả tài khoản và mật khẩu.");
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        let res;
        // If the candidate already has a job ID, we can PATCH it. Otherwise we POST a new job.
        if (id && id.length > 15) { // Check if it looks like a uuid (job ID)
          res = await fetch(`/api/registration/jobs?id=${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "save_credentials",
              username: inputUsername.trim(),
              password: inputPassword.trim(),
            }),
          });
        } else {
          res = await fetch("/api/registration/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url,
              cmsType,
              username: inputUsername.trim(),
              password: inputPassword.trim(),
            }),
          });
        }
        
        const data = await res.json();
        if (res.ok) {
          setSuccess("Lưu tài khoản thành công! Diễn đàn đã sẵn sàng đi link và tự động chuyển sang hàng đợi Đăng bài trực tiếp.");
          setEditingJobId(null);
          setInputUsername("");
          setInputPassword("");
          await fetchCandidates();
          await fetchJobs();
        } else {
          setError(data.error || "Gặp lỗi khi lưu tài khoản.");
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


      <div className="mt-7">
        {/* Candidates Panel */}
        <Panel>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Danh sách diễn đàn &amp; Trạng thái tài khoản</h2>
              <p className="text-sm text-muted">Bấm vào trạng thái "Chưa đăng ký" (màu xanh) để mở nhanh trang đăng ký của diễn đàn.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleEnqueue}
                disabled={isPending || selectedCandidates.length === 0}
                className="flex items-center gap-1.5 h-9"
              >
                {isPending ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                Enqueue ({selectedCandidates.length})
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  await fetchCandidates();
                  await fetchJobs();
                }}
                className="p-1.5 h-9 w-9 text-slate-300 hover:text-white"
                title="Tải lại danh sách"
              >
                <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>

          <div className="mt-2 overflow-x-auto rounded-md border border-border">
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
                  <th className="px-3 py-3 w-40">Trạng thái</th>
                  <th className="px-3 py-3 w-[260px]">Tài khoản tạo</th>
                  <th className="px-3 py-3 w-16 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted">
                      Chưa có ứng viên mới (hãy chạy thêm job cào URL).
                    </td>
                  </tr>
                ) : (
                  candidates.map((row) => {
                    const isEditing = editingJobId === row.id;
                    return (
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
                          <div className="truncate max-w-[360px] font-semibold text-slate-200" title={row.url}>
                            {row.url}
                          </div>
                          <span className="text-xs text-muted block truncate max-w-[360px] mt-0.5">
                            {row.title || row.domain}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-300 font-semibold">{row.cms_type}</td>
                        <td className="px-3 py-3">
                          {!row.registered ? (
                            <button
                              onClick={() => window.open(getRegisterUrl(row.url, row.cms_type), "_blank")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 hover:bg-emerald-900/30 transition shadow-sm cursor-pointer"
                              title="Bấm để mở trang đăng ký"
                            >
                              <ExternalLink size={11} /> Chưa đăng ký
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-slate-900 text-slate-400 border border-slate-800">
                              Đã đăng ký
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-300 text-xs">
                          {isEditing ? (
                            <div className="flex flex-col gap-1 w-full max-w-[220px]">
                              <input
                                type="text"
                                placeholder="Tên đăng nhập"
                                value={inputUsername}
                                onChange={(e) => setInputUsername(e.target.value)}
                                className="h-7 w-full px-2 bg-[#0c131f] border border-[#1f2b3a] rounded text-xs text-white outline-none focus:border-cyan-500"
                              />
                              <input
                                type="password"
                                placeholder="Mật khẩu"
                                value={inputPassword}
                                onChange={(e) => setInputPassword(e.target.value)}
                                className="h-7 w-full px-2 bg-[#0c131f] border border-[#1f2b3a] rounded text-xs text-white outline-none focus:border-cyan-500 mt-1"
                              />
                              <div className="flex items-center gap-1 mt-1 justify-end">
                                <button
                                  onClick={() => handleSaveCredentials(row.jobId || null, row.url, row.cms_type)}
                                  disabled={isPending}
                                  className="h-6 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-0.5 transition"
                                >
                                  <Check size={10} /> Lưu
                                </button>
                                <button
                                  onClick={() => setEditingJobId(null)}
                                  className="h-6 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-0.5 border border-slate-700 transition"
                                >
                                  <X size={10} /> Hủy
                                </button>
                              </div>
                            </div>
                          ) : !row.registered ? (
                            <button
                              onClick={() => {
                                setEditingJobId(row.id);
                                setInputUsername("");
                                setInputPassword("");
                              }}
                              className="px-2 py-1 bg-slate-850 hover:bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 transition"
                            >
                              Nhập tài khoản
                            </button>
                          ) : (
                            <div className="group relative pr-8">
                              <div className="font-semibold text-slate-100">{row.username}</div>
                              <div className="text-muted truncate max-w-[150px] font-mono text-[11px]">{row.password}</div>
                              <button
                                onClick={() => {
                                  setEditingJobId(row.id);
                                  setInputUsername(row.username || "");
                                  setInputPassword(row.password || "");
                                }}
                                className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/50 border border-cyan-800/30 text-[10px] rounded transition"
                                title="Sửa tài khoản"
                              >
                                Sửa
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {row.jobId ? (
                            <Button
                              variant="ghost"
                              onClick={() => handleDeleteJob(row.jobId!)}
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-md transition-colors"
                              title="Xóa tài khoản đã gán"
                              disabled={isPending}
                            >
                              <Trash2 size={14} />
                            </Button>
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
      </div>
    </AppShell>
  );
}
