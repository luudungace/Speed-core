"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, RefreshCw, Trash2, Send, Key, Database, FileText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Panel } from "@/components/ui";
import type { RegistrationJobRow } from "@/lib/types/registration";

export default function DirectPostingPage() {
  const [jobs, setJobs] = useState<RegistrationJobRow[]>([]);
  const [jobsCount, setJobsCount] = useState(0);
  const [jobsPage, setJobsPage] = useState(1);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [isPending, startTransition] = useTransition();

  // --- FETCHERS ---

  async function fetchJobs() {
    try {
      const res = await fetch(`/api/registration/jobs?page=${jobsPage}&pageSize=8&isDirect=true`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.rows);
        setJobsCount(data.count);
      }
    } catch (err) {
      console.error("Lỗi khi tải hàng đợi đi link trực tiếp:", err);
    }
  }

  // Load datasets
  useEffect(() => {
    void fetchJobs();
  }, [jobsPage]);

  // Dynamic poll queue updates every 5 seconds to track active workers
  useEffect(() => {
    const timer = window.setInterval(fetchJobs, 5000);
    return () => window.clearInterval(timer);
  }, [jobsPage]);

  // Delete a registration job
  function handleDeleteJob(id: string) {
    if (!confirm("Bạn có chắc chắn muốn xóa tài khoản này khỏi hàng đợi không?")) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/registration/jobs?id=${id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (res.ok) {
          setSuccess("Đã xóa tài khoản thành công.");
          setJobsPage(1);
          await fetchJobs();
        } else {
          setError(data.error || "Gặp lỗi khi xóa job.");
        }
      } catch (err) {
        setError("Lỗi kết nối.");
      }
    });
  }

  // Requeue a job (Retry)
  function handleRequeueJob(id: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/registration/jobs?id=${id}`, {
          method: "PATCH",
        });
        const data = await res.json();
        if (res.ok) {
          setSuccess("Đã đẩy tài khoản vào hàng đợi đăng bài lại!");
          await fetchJobs();
        } else {
          setError(data.error || "Gặp lỗi khi thử lại.");
        }
      } catch (err) {
        setError("Lỗi kết nối.");
      }
    });
  }

  const totalJobPages = Math.max(1, Math.ceil(jobsCount / 8));

  return (
    <AppShell title="Đăng bài trực tiếp">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal text-white">Đăng bài trực tiếp (Direct Posting)</h1>
        <p className="text-sm text-muted">
          Workflow chuyên biệt dành cho tài khoản có sẵn. Robot sẽ bỏ qua toàn bộ bước đăng ký &amp; kích hoạt email, trực tiếp đăng nhập và viết bài đi link.
        </p>
      </div>

      {/* Form thêm tài khoản diễn đàn (Nhập đơn lẻ hoặc Nhập hàng loạt) */}
      <div className="mt-6">
        <Panel className="bg-[#0b121f]/90 border-[#1f2d42] p-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Key className="text-cyan-400" size={18} />
              <div>
                <h2 className="text-base font-semibold text-white">Nạp tài khoản diễn đàn sẵn có</h2>
                <p className="text-xs text-muted mt-0.5">Hệ thống tự động sử dụng tài khoản/mật khẩu này để đăng nhập và đăng bài viết.</p>
              </div>
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
              const username = formData.get("username") as string;
              const password = formData.get("password") as string;

              if (!url || !cmsType || !username || !password) {
                setError("Vui lòng điền đầy đủ tất cả các trường (URL, CMS, Tài khoản, Mật khẩu).");
                return;
              }

              setError(null);
              setSuccess(null);
              
              startTransition(async () => {
                try {
                  const res = await fetch("/api/registration/jobs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url, cmsType, username, password }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setSuccess("Đã nạp tài khoản có sẵn thành công vào hàng đợi đi link trực tiếp.");
                    target.reset();
                    setJobsPage(1);
                    await fetchJobs();
                  } else {
                    setError(data.error || "Gặp lỗi khi thêm tài khoản.");
                  }
                } catch (err) {
                  setError("Lỗi kết nối.");
                }
              });
            }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
              <div className="flex flex-col gap-1.5 lg:col-span-2">
                <label className="text-xs text-slate-300 font-medium">Địa chỉ diễn đàn (URL)</label>
                <input
                  type="url"
                  name="url"
                  required
                  placeholder="https://diendan.com/topic-hoac-forum"
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
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-300 font-medium">Tên đăng nhập (Username)</label>
                <input
                  type="text"
                  name="username"
                  required
                  placeholder="Tên đăng nhập có sẵn"
                  className="h-9 rounded-md border border-[#1f2b3a] bg-[#0d141d] px-3 text-sm text-white outline-none placeholder:text-muted focus:border-primary/70"
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-300 font-medium">Mật khẩu (Password)</label>
                <input
                  type="text"
                  name="password"
                  required
                  placeholder="Mật khẩu của tài khoản"
                  className="h-9 rounded-md border border-[#1f2b3a] bg-[#0d141d] px-3 text-sm text-white outline-none placeholder:text-muted focus:border-primary/70"
                />
              </div>
              
              <div className="sm:col-span-2 lg:col-span-5 flex justify-end">
                <Button type="submit" disabled={isPending} className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white">
                  {isPending ? <RefreshCw size={14} className="animate-spin mr-1.5" /> : null}
                  Kích hoạt đăng bài trực tiếp
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={(e) => {
              e.preventDefault();
              const target = e.currentTarget;
              const formData = new FormData(target);
              const bulkText = formData.get("bulkText") as string;

              if (!bulkText.trim()) {
                setError("Vui lòng nhập danh sách tài khoản.");
                return;
              }

              setError(null);
              setSuccess(null);

              const lines = bulkText.split("\n");
              const jobs: Array<{ url: string; cmsType: string; username?: string; password?: string }> = [];
              
              for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line || line.startsWith("#")) continue;
                
                const parts = line.split(/[|,]/);
                const url = parts[0]?.trim();
                const cmsType = parts[1]?.trim() || "XenForo";
                const username = parts[2]?.trim() || "";
                const password = parts[3]?.trim() || "";
                
                if (url && username && password) {
                  jobs.push({ url, cmsType, username, password });
                }
              }

              if (jobs.length === 0) {
                setError("Không tìm thấy tài khoản hợp lệ nào có đủ 4 trường thông tin. Định dạng bắt buộc: URL | CMS | Username | Password");
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
                    setSuccess(`Đã nạp hàng loạt thành công ${data.count} tài khoản vào hàng đợi đi link trực tiếp.`);
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
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-300 font-medium">Danh sách tài khoản (Định dạng bắt buộc: `URL | Loại CMS | Username | Password` )</label>
                <textarea
                  name="bulkText"
                  required
                  rows={6}
                  placeholder="https://diendan1.com | XenForo | account1 | pass123&#10;https://diendan2.com | phpBB | account2 | pass456&#10;https://diendan3.com | WordPress | account3 | pass789"
                  className="rounded-md border border-[#1f2b3a] bg-[#0d141d] p-3 text-sm text-white outline-none placeholder:text-muted/70 focus:border-primary/70 font-mono resize-y"
                />
                <p className="text-[11px] text-muted">
                  * Mỗi dòng bắt buộc phải có đầy đủ URL, Loại CMS, Tài khoản và Mật khẩu. Phân cách bằng dấu gạch đứng (`|`) hoặc dấu phẩy (`,`).
                </p>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isPending} className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white">
                  {isPending ? <RefreshCw size={14} className="animate-spin mr-1.5" /> : null}
                  Nhập hàng loạt &amp; Đăng bài
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

      {/* Direct Posting Queue Panel */}
      <Panel className="mt-7">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Send className="text-cyan-400 animate-pulse" size={18} />
            <h2 className="text-base font-semibold text-white">Hàng đợi đi link trực tiếp ({jobsCount})</h2>
          </div>
          <Button variant="ghost" onClick={fetchJobs} className="p-1.5 h-8 w-8" title="Tải lại hàng đợi">
            <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[#101722] text-muted font-medium">
              <tr>
                <th className="px-4 py-3">Diễn đàn mục tiêu</th>
                <th className="px-4 py-3 w-40">Tài khoản &amp; Mật khẩu</th>
                <th className="px-4 py-3 w-36 text-center">Trạng thái</th>
                <th className="px-4 py-3 w-72">Nhật ký chi tiết / Lý do lỗi</th>
                <th className="px-4 py-3 w-24 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="h-24 text-center text-muted">
                    Chưa có tài khoản đi link trực tiếp nào trong hàng đợi.
                  </td>
                </tr>
              ) : (
                jobs.map((row) => (
                  <tr key={row.id} className="hover:bg-[#0e1726]/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      <div className="truncate max-w-[280px]" title={row.url}>
                        {row.url}
                      </div>
                      <span className="text-xs text-muted block mt-0.5">{row.cms_type}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs font-mono">
                      <div className="font-semibold text-slate-100">{row.username}</div>
                      <div className="text-muted truncate max-w-[150px]">{row.password}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          row.status === "success"
                            ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/50"
                            : row.status === "failed"
                            ? "bg-red-950/50 text-red-400 border border-red-900/50"
                            : row.status === "processing"
                            ? "bg-amber-950/50 text-amber-400 border border-amber-900/50"
                            : "bg-slate-900 text-slate-400 border border-slate-800"
                        }`}
                      >
                        {row.status === "success"
                          ? "Thành công"
                          : row.status === "failed"
                          ? "Thất bại"
                          : row.status === "processing"
                          ? "Đang chạy..."
                          : "Đang đợi"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.status === "failed" && row.error ? (
                        <span className="text-red-400 font-medium block max-w-[280px] line-clamp-2" title={row.error}>
                          {row.error}
                        </span>
                      ) : row.status === "processing" ? (
                        <span className="text-amber-400 flex items-center gap-1.5">
                          <RefreshCw size={11} className="animate-spin" />
                          Đang đăng nhập và soạn bài...
                        </span>
                      ) : row.status === "success" ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          ✓ Đã hoàn tất bài đăng
                        </span>
                      ) : (
                        <span className="text-muted italic">Đang chờ Robot khởi động...</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {row.status === "failed" && (
                          <button
                            onClick={() => handleRequeueJob(row.id)}
                            className="p-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40 rounded transition"
                            title="Thử lại ngay"
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteJob(row.id)}
                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition"
                          title="Xóa bỏ"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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
    </AppShell>
  );
}
