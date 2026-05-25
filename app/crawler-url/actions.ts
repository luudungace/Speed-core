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
})
 {
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
}

export async function cancelCrawlJobAction(jobId: string) {
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
}
