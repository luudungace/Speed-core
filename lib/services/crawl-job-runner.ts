import { CrawlerRepository } from "@/lib/repositories/crawler-repository";
import { PlaywrightCrawlerService } from "@/lib/services/playwright-crawler";
import { SerperService } from "@/lib/services/serper-service";

export async function runCrawlJob(jobId: string) {
  const repo = new CrawlerRepository();
  const serper = new SerperService();
  const crawler = new PlaywrightCrawlerService();

  try {
    const job = await repo.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found.`);

    await repo.updateJob(jobId, { status: "running" });
    await repo.addLog(jobId, `Bắt đầu job với ${job.dorks.length} dork, ${job.pages_per_dork} trang / dork.`);

    const urls = await serper.searchMany(job.dorks, job.pages_per_dork);
    await repo.updateJob(jobId, { total_urls: urls.length });
    await repo.addLog(jobId, `Serper trả về ${urls.length} URL sau khi loại trùng và lọc mạng xã hội.`);

    let success = 0;
    let failed = 0;
    let processed = 0;

    for (const item of urls) {
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

    await repo.updateJob(jobId, { status: "completed" });
    await repo.addLog(jobId, `Hoàn tất job. Thành công ${success}, lỗi ${failed}.`);
  } catch (error) {
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
