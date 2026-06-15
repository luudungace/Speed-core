"use client";

import { useEffect, useState } from "react";
import { Download, Search, CheckCircle2, XCircle, ExternalLink, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Panel } from "@/components/ui";

type PostedBacklink = {
  id: string;
  forum_url: string;
  posted_url: string;
  status: string;
  posted_at: string;
  is_alive: boolean;
  last_checked_at: string | null;
  details?: {
    username?: string;
    title?: string;
    category?: string;
    cmsType?: string;
  };
};

export default function PostedBacklinksPage() {
  const [backlinks, setBacklinks] = useState<PostedBacklink[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchBacklinks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/posted-backlinks");
      if (res.ok) {
        const data = await res.json();
        setBacklinks(data.backlinks || []);
      }
    } catch (err) {
      console.error("Lỗi fetch backlinks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBacklinks();
  }, []);

  const handleExportCSV = () => {
    if (backlinks.length === 0) return;
    const headers = ["ID", "Forum URL", "Posted URL", "Status", "Is Alive", "Posted At", "Username", "Title", "Category", "CMS Type"];
    const rows = backlinks.map((link) => [
      link.id,
      link.forum_url,
      link.posted_url,
      link.status,
      link.is_alive ? "YES" : "NO",
      link.posted_at,
      link.details?.username || "",
      link.details?.title || "",
      link.details?.category || "",
      link.details?.cmsType || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `posted_backlinks_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLinks = backlinks.filter(
    (link) =>
      link.forum_url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.posted_url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (link.details?.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (link.details?.username || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell title="Backlink đã đăng">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">Backlink đã đăng</h1>
          <p className="mt-1 text-sm text-muted">Thành phẩm cuối: URL bài viết worker đăng thành công.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={fetchBacklinks} disabled={loading} className="h-8 gap-2 px-3 text-xs">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Làm mới
          </Button>
          <Button variant="ghost" onClick={handleExportCSV} disabled={backlinks.length === 0} className="h-8 gap-2 px-3 text-xs">
            <Download size={13} />
            Xuất CSV
          </Button>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-md border border-border/50 bg-background/50 px-3 py-2">
        <Search size={16} className="text-muted" />
        <input
          type="text"
          placeholder="Tìm kiếm theo URL, tiêu đề, username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </div>

      <Panel className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Danh sách bài đăng ({filteredLinks.length})
          </h2>
        </div>

        <div className="mt-4 overflow-x-auto rounded-md border border-border/40 bg-card/10">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20 text-muted font-medium">
                <th className="p-3">Diễn đàn (Forum)</th>
                <th className="p-3">Bài viết (Posted URL)</th>
                <th className="p-3">Trạng thái (Check)</th>
                <th className="p-3">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="h-28 text-center text-muted">
                    <RefreshCw size={20} className="mx-auto animate-spin" />
                    <p className="mt-2 text-xs">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="h-28 text-center text-muted">
                    Không tìm thấy backlink nào.
                  </td>
                </tr>
              ) : (
                filteredLinks.map((link) => (
                  <tr key={link.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                    <td className="p-3 max-w-[240px] truncate">
                      <div className="font-medium text-foreground">{new URL(link.forum_url).hostname}</div>
                      <div className="text-xs text-muted truncate">{link.forum_url}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={link.posted_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline font-medium truncate max-w-[320px]"
                        >
                          {link.details?.title || "Xem bài đăng"}
                          <ExternalLink size={12} />
                        </a>
                      </div>
                      {link.details?.username && (
                        <div className="text-xs text-muted">
                          Người đăng: <span className="text-foreground/80">{link.details.username}</span>
                          {link.details.category && ` | Chuyên mục: ${link.details.category}`}
                          {link.details.cmsType && ` (${link.details.cmsType})`}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {link.is_alive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-500">
                          <CheckCircle2 size={12} /> Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
                          <XCircle size={12} /> Dead/Removed
                        </span>
                      )}
                      {link.last_checked_at && (
                        <div className="mt-0.5 text-[10px] text-muted">
                          Checked: {new Date(link.last_checked_at).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-muted text-xs">
                      {new Date(link.posted_at).toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
