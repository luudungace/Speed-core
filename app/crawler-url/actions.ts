"use server";

import { CrawlerRepository } from "@/lib/repositories/crawler-repository";
import { normalizeDorks, runCrawlJob } from "@/lib/services/crawl-job-runner";

export async function startCrawlJobAction(input: { dorks: string; pagesPerDork: number }) {
  const dorks = normalizeDorks(input.dorks);
  const pagesPerDork = Math.max(1, Math.min(10, Number(input.pagesPerDork) || 2));

  if (dorks.length === 0) {
    return { ok: false as const, error: "Vui lòng nhập ít nhất 1 Google Dork." };
  }

  const repo = new CrawlerRepository();
  const job = await repo.createJob(dorks, pagesPerDork);
  await repo.addLog(job.id, "Job đã vào queue.");

  // MVP local worker. This can be replaced by Redis/BullMQ or a Supabase edge worker without changing the UI contract.
  void runCrawlJob(job.id);

  return { ok: true as const, jobId: job.id };
}
