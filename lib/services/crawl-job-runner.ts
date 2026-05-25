import { CrawlerRepository } from "@/lib/repositories/crawler-repository";
import { PlaywrightCrawlerService } from "@/lib/services/playwright-crawler";
import { SerperService } from "@/lib/services/serper-service";

async function isJobCancelled(repo: CrawlerRepository, jobId: string) {
  const job = await repo.getJob(jobId);
  return job?.status === "cancelled";
}

export async function runCrawlJob(jobId: string) {
  const repo = new CrawlerRepository();
  const serper = new SerperService();
  const crawler = new PlaywrightCrawlerService();

  try {
    const job = await repo.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found.`);
    if (job.status === "cancelled") return;

    await repo.updateJob(jobId, { status: "running" });
    const jobLabel = job.name?.trim() || jobId.slice(0, 8);
    const excludeDomains = job.exclude_domains ?? [];
    await repo.addLog(
      jobId,
      `Bắt đầu "${jobLabel}": ${job.dorks.length} dork, ${job.pages_per_dork} trang/dork, max ${job.max_urls} URL, loại trừ ${excludeDomains.length} domain.`,
    );

    const found = await serper.searchMany(job.dorks, job.pages_per_dork, excludeDomains);
    if (await isJobCancelled(repo, jobId)) {
      await repo.addLog(jobId, "Job đã dừng trước khi crawl URL.", "warn");
      return;
    }

    const urls = found.slice(0, job.max_urls);
    await repo.updateJob(jobId, { total_urls: urls.length });
    await repo.addLog(
      jobId,
      `Serper: ${found.length} URL sau lọc. Crawl ${urls.length} URL${found.length > urls.length ? ` (giới hạn max ${job.max_urls})` : ""}.`,
    );

    let success = 0;
    let failed = 0;
    let processed = 0;

    for (const item of urls) {
      if (await isJobCancelled(repo, jobId)) {
        await repo.addLog(jobId, `Dừng crawl sau ${processed}/${urls.length} URL.`, "warn");
        return;
      }

      await repo.addLog(jobId, `Crawl ${item.url}`);
      const result = await crawler.crawl(item);
      await repo.upsertResult(jobId, result);

      processed += 1;
      if (result.status === "success") success += 1;
      else failed += 1;

      await repo.updateJob(jobId, {
        processed_urls: processed,
        success_count: success,
        failed_count: failed,
      });
      await repo.addLog(jobId, `${result.status === "success" ? "OK" : "FAIL"} ${result.domain} - ${result.cms_type}`);
    }

    if (await isJobCancelled(repo, jobId)) {
      await repo.addLog(jobId, "Job đã dừng.", "warn");
      return;
    }

    await repo.updateJob(jobId, { status: "completed" });
    await repo.addLog(jobId, `Hoàn tất job. Thành công ${success}, lỗi ${failed}.`);
  } catch (error) {
    if (await isJobCancelled(repo, jobId)) {
      await repo.addLog(jobId, "Job đã dừng.", "warn");
      return;
    }

    const message = error instanceof Error ? error.message : "Unknown job error";
    await repo.updateJob(jobId, { status: "failed", error: message });
    await repo.addLog(jobId, message, "error");
  } finally {
    await crawler.close();
  }
}

export function normalizeDorks(input: unknown) {
  if (typeof input !== "string") return [];
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);
}
