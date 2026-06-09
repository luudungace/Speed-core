"use server";

import { CrawlerRepository } from "@/lib/repositories/crawler-repository";
import { normalizeDorks, runCrawlJob } from "@/lib/services/crawl-job-runner";
import { normalizeExcludeDomains } from "@/lib/utils/crawler-filters";

export async function startCrawlJobAction(input: {
  dorks: string;
  pagesPerDork: number;
  name?: string;
  maxUrls?: number;
  excludeDomains?: string;
}) {
  try {
    const dorks = normalizeDorks(input.dorks);
    const pagesPerDork = Math.max(1, Math.min(10, Number(input.pagesPerDork) || 2));
    const maxUrls = Math.max(10, Math.min(2000, Number(input.maxUrls) || 500));
    const excludeDomains = normalizeExcludeDomains(input.excludeDomains ?? "");
    const name = input.name?.trim().slice(0, 120) || null;

    if (dorks.length === 0) {
      return { ok: false as const, error: "Vui lòng nhập ít nhất 1 Google Dork." };
    }

    const repo = new CrawlerRepository();
    const job = await repo.createJob({
      dorks,
      pagesPerDork,
      name,
      maxUrls,
      excludeDomains,
    });
    await repo.addLog(job.id, "Job đã vào queue.");

    void runCrawlJob(job.id);

    return { ok: true as const, jobId: job.id };
  } catch (err: any) {
    console.error("Lỗi trong startCrawlJobAction:", err);
    let msg = "Lỗi hệ thống khi bắt đầu job.";
    if (err && typeof err === "object") {
      if (err.code === "PGRST205" || err.message?.includes("crawl_jobs")) {
        msg = "Lỗi: Không tìm thấy bảng 'crawl_jobs' trong cơ sở dữ liệu Supabase của bạn. Vui lòng chạy các câu lệnh SQL khởi tạo bảng trong Supabase SQL Editor.";
      } else {
        msg = err.message || JSON.stringify(err);
      }
    }
    return { ok: false as const, error: msg };
  }
}

export async function cancelCrawlJobAction(jobId: string) {
  try {
    if (!jobId?.trim()) {
      return { ok: false as const, error: "Không có job đang chạy." };
    }

    const repo = new CrawlerRepository();
    const job = await repo.getJob(jobId);
    if (!job) {
      return { ok: false as const, error: "Job không tồn tại." };
    }

    if (["completed", "failed", "cancelled"].includes(job.status)) {
      return { ok: false as const, error: "Job đã kết thúc, không thể dừng." };
    }

    await repo.updateJob(jobId, { status: "cancelled" });
    await repo.addLog(jobId, "Đã nhận lệnh dừng crawl.", "warn");

    return { ok: true as const };
  } catch (err: any) {
    console.error("Lỗi trong cancelCrawlJobAction:", err);
    let msg = "Lỗi hệ thống khi dừng job.";
    if (err && typeof err === "object") {
      if (err.code === "PGRST205" || err.message?.includes("crawl_jobs")) {
        msg = "Lỗi: Không tìm thấy bảng 'crawl_jobs' trong Supabase.";
      } else {
        msg = err.message || String(err);
      }
    }
    return { ok: false as const, error: msg };
  }
}

export async function setCrawlJobPausedAction(jobId: string, paused: boolean) {
  try {
    if (!jobId?.trim()) {
      return { ok: false as const, error: "KhÃ´ng cÃ³ job Ä‘ang cháº¡y." };
    }

    const repo = new CrawlerRepository();
    const job = await repo.getJob(jobId);
    if (!job) {
      return { ok: false as const, error: "Job khÃ´ng tá»“n táº¡i." };
    }

    if (["completed", "failed", "cancelled"].includes(job.status)) {
      return { ok: false as const, error: "Job Ä‘Ã£ káº¿t thÃºc." };
    }

    await repo.updateJob(jobId, {
      metadata: {
        ...job.metadata,
        pause_requested: paused,
      },
    });
    await repo.addLog(jobId, paused ? "ÄÃ£ táº¡m dá»«ng crawl." : "Tiáº¿p tá»¥c crawl.", paused ? "warn" : "info");

    return { ok: true as const };
  } catch (err: any) {
    console.error("Lá»—i trong setCrawlJobPausedAction:", err);
    let msg = paused ? "Lá»—i há»‡ thá»‘ng khi táº¡m dá»«ng job." : "Lá»—i há»‡ thá»‘ng khi tiáº¿p tá»¥c job.";
    if (err && typeof err === "object") {
      msg = err.message || String(err);
    }
    return { ok: false as const, error: msg };
  }
}

