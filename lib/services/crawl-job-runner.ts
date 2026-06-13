import { CrawlerRepository } from "@/lib/repositories/crawler-repository";
import { BacklinksShService } from "@/lib/services/backlinks-sh-service";
import { PlaywrightCrawlerService } from "@/lib/services/playwright-crawler";
import { SerperService } from "@/lib/services/serper-service";
import type { SerperResult } from "@/lib/types/crawler";

async function isJobCancelled(repo: CrawlerRepository, jobId: string) {
  const job = await repo.getJob(jobId);
  return job?.status === "cancelled";
}

function formatJobError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error) {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((value) => typeof value === "string" && value.trim())
      .map(String);
    if (parts.length > 0) return parts.join(" | ");
  }
  return typeof error === "string" && error.trim() ? error : "Unknown job error";
}

function formatWarnError(error: unknown) {
  const message = formatJobError(error);
  return message.length > 220 ? `${message.slice(0, 220)}...` : message;
}

export async function runCrawlJob(jobId: string) {
  const repo = new CrawlerRepository();
  const serper = new SerperService();
  const backlinks = new BacklinksShService();
  const crawler = new PlaywrightCrawlerService();

  try {
    const job = await repo.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found.`);
    if (job.status === "cancelled") return;

    await repo.updateJob(jobId, { status: "running" });
    const jobLabel = job.name?.trim() || jobId.slice(0, 8);
    const excludeDomains = job.exclude_domains ?? [];
    const backlinkTargets = job.backlink_targets ?? [];
    const directUrls = job.direct_urls ?? [];
    const sourceLabels = [
      directUrls.length > 0 ? `${directUrls.length} URL recrawl` : null,
      job.dorks.length > 0 ? `${job.dorks.length} dork, ${job.pages_per_dork} trang/dork` : null,
      backlinkTargets.length > 0 ? `${backlinkTargets.length} competitor backlink` : null,
    ].filter(Boolean);
    await repo.addLog(
      jobId,
      `Bắt đầu "${jobLabel}": ${sourceLabels.join(" + ") || "không có nguồn"}, max ${job.max_urls} URL, loại trừ ${excludeDomains.length} domain.`,
    );

    const foundByUrl = new Map<string, SerperResult>();
    if (directUrls.length > 0) {
      for (const url of directUrls) {
        foundByUrl.set(url, {
          url,
          title: url,
          snippet: "Direct recrawl",
          raw: {
            provider: "direct-recrawl",
          },
        });
      }
      await repo.addLog(jobId, `Recrawl: ${directUrls.length} URL Ä‘Æ°á»£c chá»n.`);
    }

    if (job.dorks.length > 0) {
      const serperResults = await serper.searchMany(job.dorks, job.pages_per_dork, excludeDomains);
      for (const result of serperResults) foundByUrl.set(result.url, result);
      await repo.addLog(jobId, `Serper: ${serperResults.length} URL sau lọc.`);
    }

    if (backlinkTargets.length > 0) {
      const backlinkResults = await backlinks.findManySources(
        backlinkTargets,
        job.backlink_source_limit,
        excludeDomains,
      );
      for (const result of backlinkResults) foundByUrl.set(result.url, result);
      await repo.addLog(
        jobId,
        `backlinks.sh: ${backlinkResults.length} source domain active từ ${backlinkTargets.length} competitor.`,
      );
    }

    const found = [...foundByUrl.values()];
    if (await isJobCancelled(repo, jobId)) {
      await repo.addLog(jobId, "Job đã dừng trước khi crawl URL.", "warn");
      return;
    }

    const isDirectRecrawlOnly = directUrls.length > 0 && job.dorks.length === 0 && backlinkTargets.length === 0;
    let existingUrls = new Set<string>();
    if (!isDirectRecrawlOnly) {
      try {
        existingUrls = await repo.getExistingUrls(found.map((item) => item.url));
      } catch (error) {
        await repo.addLog(jobId, `Không kiểm tra được URL trùng, tiếp tục crawl. Lỗi: ${formatWarnError(error)}`, "warn");
      }
    }
    const newUrls = existingUrls.size > 0 ? found.filter((item) => !existingUrls.has(item.url)) : found;
    if (existingUrls.size > 0) {
      await repo.addLog(jobId, `Bỏ qua ${existingUrls.size} URL đã có trong bảng kết quả.`);
    }

    const urls = newUrls.slice(0, job.max_urls);
    await repo.updateJob(jobId, { total_urls: urls.length });
    const sourceSummary =
      directUrls.length > 0
        ? "Recrawl"
        : job.dorks.length > 0 && backlinkTargets.length > 0
        ? "Serper + backlinks.sh"
        : backlinkTargets.length > 0
          ? "backlinks.sh"
          : "Serper";
    await repo.addLog(
      jobId,
      `${sourceSummary}: ${newUrls.length} URL mới sau lọc trùng. Crawl ${urls.length} URL${newUrls.length > urls.length ? ` (giới hạn max ${job.max_urls})` : ""}.`,
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

    const message = formatJobError(error);
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
