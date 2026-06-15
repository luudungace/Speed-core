"use client";

import { useEffect, useState, useTransition } from "react";
import { RefreshCw, Send, ShieldCheck, Key, Mail, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Panel } from "@/components/ui";
import type { RegistrationJobRow } from "@/lib/types/registration";

export default function RegisteredForumsPage() {
  const [forums, setForums] = useState<RegistrationJobRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states for manual registration addition
  const [newUrl, setNewUrl] = useState("");
  const [newCmsType, setNewCmsType] = useState("XenForo");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);

  async function fetchRegisteredForums() {
    setLoading(true);
    try {
      const res = await fetch(`/api/registration/jobs?hasAccount=true&page=${page}&pageSize=15`);
      if (res.ok) {
        const data = await res.json();
        setForums(data.rows);
        setCount(data.count);
      }
    } catch (err) {
      console.error("Lỗi khi tải danh sách diễn đàn đã đăng ký:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRegisteredForums();
  }, [page]);

  function handlePostBacklink(id: string, url: string) {
    if (!confirm(`Bạn có chắc chắn muốn kích hoạt robot tự động đăng bài viết backlink lên diễn đàn: ${url}?`)) return;
    setSuccessMsg(null);
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/registration/jobs?id=${id}`, {
          method: "PATCH",
        });
        const data = await res.json();
        if (res.ok) {
          setSuccessMsg(`Đã đưa diễn đàn ${url} vào hàng đợi đăng bài! Robot đi link sẽ tự động thực hiện ngay.`);
          // Reload list to see state update
          await fetchRegisteredForums();
        } else {
          setErrorMsg(data.error || "Gặp lỗi khi đưa job vào hàng đợi đăng bài.");
        }
      } catch (err) {
        setErrorMsg("Lỗi kết nối.");
      }
    });
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newUrl || !newCmsType || !newUsername || !newPassword) {
      setErrorMsg("Vui lòng điền đầy đủ tất cả các trường thông tin bắt buộc.");
      return;
    }
    setSuccessMsg(null);
    setErrorMsg(null);
    setAdding(true);

    try {
      const res = await fetch("/api/registration/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl,
          cmsType: newCmsType,
          username: newUsername,
          password: newPassword,
          emailUsed: newEmail || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Đã thêm thành công tài khoản diễn đàn ${newUrl} vào hàng đợi đăng bài!`);
        // Reset form
        setNewUrl("");
        setNewUsername("");
        setNewPassword("");
        setNewEmail("");
        // Reload list
        await fetchRegisteredForums();
      } else {
        setErrorMsg(data.error || "Gặp lỗi khi thêm tài khoản diễn đàn.");
      }
    } catch (err) {
      setErrorMsg("Lỗi kết nối.");
    } finally {
      setAdding(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / 15));

  return (
    <AppShell title="Diễn đàn đã đăng ký">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal text-white">Diễn đàn đã có tài khoản</h1>
        <p className="text-sm text-muted">
          Tất cả diễn đàn đã tạo được tài khoản (bao gồm cả các job đăng ký thành công nhưng chưa đăng bài). Bạn có thể ra lệnh cho robot đăng bài đi link bất kỳ lúc nào.
        </p>
      </div>

      {successMsg && (
        <div className="mt-4 p-3 rounded-md bg-emerald-950/40 border border-emerald-900/40 text-emerald-300 text-sm">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 p-3 rounded-md bg-red-950/40 border border-red-900/40 text-red-300 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Manual Forum Insertion Panel */}
      <Panel className="mt-6 border border-slate-800/80 bg-[#070b11]/80">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Key className="text-cyan-400" size={18} />
          <span>Thêm tài khoản diễn đàn thủ công</span>
        </h2>
        <form onSubmit={handleAddAccount} className="grid gap-4 md:grid-cols-5 items-end">
          <div className="flex flex-col gap-1.5 md:col-span-1">
            <label className="text-xs text-slate-300 font-medium">Diễn đàn URL <span className="text-red-400">*</span></label>
            <input
              type="url"
              required
              placeholder="https://diendan.com/forum/"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="h-9 rounded-md border border-[#1f2b3a] bg-[#0d141d] px-3 text-sm text-white outline-none focus:border-cyan-500/70"
            />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-1">
            <label className="text-xs text-slate-300 font-medium">Loại CMS <span className="text-red-400">*</span></label>
            <select
              value={newCmsType}
              onChange={(e) => setNewCmsType(e.target.value)}
              required
              className="h-9 rounded-md border border-[#1f2b3a] bg-[#0d141d] px-3 text-sm text-white outline-none focus:border-cyan-500/70"
            >
              <option value="XenForo">XenForo</option>
              <option value="vBulletin">vBulletin</option>
              <option value="phpBB">phpBB</option>
              <option value="Discuz">Discuz</option>
              <option value="MyBB">MyBB</option>
              <option value="WordPress">WordPress</option>
              <option value="Fallback">Khác (Fallback)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-1">
            <label className="text-xs text-slate-300 font-medium">Tên đăng nhập <span className="text-red-400">*</span></label>
            <input
              type="text"
              required
              placeholder="Username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="h-9 rounded-md border border-[#1f2b3a] bg-[#0d141d] px-3 text-sm text-white outline-none focus:border-cyan-500/70"
            />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-1">
            <label className="text-xs text-slate-300 font-medium">Mật khẩu <span className="text-red-400">*</span></label>
            <input
              type="text"
              required
              placeholder="Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-9 rounded-md border border-[#1f2b3a] bg-[#0d141d] px-3 text-sm text-white outline-none focus:border-cyan-500/70"
            />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-1">
            <label className="text-xs text-slate-300 font-medium">Email đã dùng (Tùy chọn)</label>
            <input
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="h-9 rounded-md border border-[#1f2b3a] bg-[#0d141d] px-3 text-sm text-white outline-none focus:border-cyan-500/70"
            />
          </div>
          <div className="md:col-span-5 flex justify-end mt-2">
            <Button
              type="submit"
              disabled={adding}
              className="w-full md:w-auto bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center justify-center gap-1.5 h-9"
            >
              {adding ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              <span>Thêm &amp; Đăng bài tự động</span>
            </Button>
          </div>
        </form>
      </Panel>

      <Panel className="mt-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-emerald-400" size={18} />
            <h2 className="text-base font-semibold text-white">Có tài khoản ({count})</h2>
          </div>
          <Button variant="ghost" onClick={fetchRegisteredForums} className="p-1.5 h-8 w-8" title="Tải lại">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>

        <div className="mt-6 overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[#101722] text-muted font-medium">
              <tr>
                <th className="px-4 py-3">Diễn đàn</th>
                <th className="px-4 py-3 w-44">Tài khoản &amp; Mật khẩu</th>
                <th className="px-4 py-3 w-48">Email đã dùng</th>
                <th className="px-4 py-3 w-36">Ngày đăng ký</th>
                <th className="px-4 py-3 w-32 text-center">Đăng bài</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && forums.length === 0 ? (
                <tr>
                  <td colSpan={5} className="h-24 text-center text-muted">
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-primary" />
                      Đang tải dữ liệu...
                    </span>
                  </td>
                </tr>
              ) : forums.length === 0 ? (
                <tr>
                  <td colSpan={5} className="h-24 text-center text-muted">
                    Chưa có diễn đàn nào được đăng ký thành công.
                  </td>
                </tr>
              ) : (
                forums.map((row) => (
                  <tr key={row.id} className="hover:bg-[#0e1726]/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      <div className="truncate max-w-[200px]" title={row.url}>
                        {row.url}
                      </div>
                      <span className="text-xs text-muted block">{row.cms_type}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                        <Key size={11} className="text-slate-400 shrink-0" />
                        <span>{row.username}</span>
                      </div>
                      <div className="text-muted pl-4 truncate max-w-[130px]" title={row.password || ""}>
                        {row.password}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">
                      {row.email_used ? (
                        <div className="flex items-center gap-1.5">
                          <Mail size={11} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[150px]" title={row.email_used}>
                            {row.email_used}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {new Date(row.updated_at || row.created_at).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        onClick={() => handlePostBacklink(row.id, row.url)}
                        disabled={isPending}
                        className="h-8 px-3 text-xs flex items-center justify-center gap-1 mx-auto bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 hover:text-emerald-200 rounded-md transition-all shadow-sm shadow-emerald-950/20"
                        title="Đẩy vào hàng đợi tự động đi link"
                      >
                        <Send size={11} className="shrink-0" />
                        <span>Đăng bài</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted">
          <Button
            variant="ghost"
            onClick={() => setPage((val) => Math.max(1, val - 1))}
            disabled={page <= 1}
            className="h-8 px-2.5 text-xs"
          >
            Trước
          </Button>
          <span>
            Trang {page}/{totalPages}
          </span>
          <Button
            variant="ghost"
            onClick={() => setPage((val) => Math.min(totalPages, val + 1))}
            disabled={page >= totalPages}
            className="h-8 px-2.5 text-xs"
          >
            Sau
          </Button>
        </div>
      </Panel>
    </AppShell>
  );
}
