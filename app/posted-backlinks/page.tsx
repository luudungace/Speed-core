"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, Link2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Panel } from "@/components/ui";
import type { PostedBacklinkRow } from "@/lib/types/backlinks";

export default function PostedBacklinksPage() {
  const [backlinks, setBacklinks] = useState<PostedBacklinkRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  async function fetchBacklinks() {
    setLoading(true);
    try {
      const res = await fetch(`/api/posted-backlinks?page=${page}&pageSize=15`);
      if (res.ok) {
        const data = await res.json();
        setBacklinks(data.rows);
        setCount(data.count);
      }
    } catch (err) {
      console.error("Lỗi khi tải backlinks đã đăng:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchBacklinks();
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(count / 15));
  const exportUrl = "/api/posted-backlinks/export";

  return (
    <AppShell title="Backlink đã đăng">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal text-white">Backlink đã đăng</h1>
          <p className="text-sm text-muted">Thành phẩm cuối: các URL bài đăng bài viết chứa backlink thành công.</p>
        </div>

        <a href={exportUrl} download="posted-backlinks.xlsx">
          <Button variant="ghost" className="flex items-center gap-1.5 hover:bg-[#162130]">
            <Download size={15} />
            Export XLSX
          </Button>
        </a>
      </div>

      <Panel className="mt-7">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Posts ({count})</h2>
          <Button variant="ghost" onClick={fetchBacklinks} className="p-1.5 h-8 w-8" title="Tải lại">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>

        <div className="mt-6 overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[#101722] text-muted font-medium">
              <tr>
                <th className="px-4 py-3">Forum</th>
                <th className="px-4 py-3 w-max">Posted URL</th>
                <th className="px-4 py-3 w-32">Trạng thái</th>
                <th className="px-4 py-3 w-44">Đăng lúc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && backlinks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="h-24 text-center text-muted">
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-primary" />
                      Đang tải...
                    </span>
                  </td>
                </tr>
              ) : backlinks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="h-24 text-center text-muted">
                    Chưa có backlink nào được đăng thành công.
                  </td>
                </tr>
              ) : (
                backlinks.map((row) => (
                  <tr key={row.id} className="hover:bg-[#0e1726]/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      <div className="truncate max-w-[220px]" title={row.forum_url}>
                        {row.forum_url}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-primary font-medium hover:underline">
                      <a
                        href={row.posted_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5"
                      >
                        <Link2 size={13} className="shrink-0" />
                        <span className="truncate max-w-[360px]" title={row.posted_url}>
                          {row.posted_url}
                        </span>
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                          row.status === "success"
                            ? "bg-emerald-950/40 text-emerald-300 border border-emerald-900/40"
                            : "bg-red-950/40 text-red-300 border border-red-900/40"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {new Date(row.posted_at || row.created_at).toLocaleString("vi-VN")}
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
