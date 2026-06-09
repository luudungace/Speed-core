import { CrawlerRepository } from "@/lib/repositories/crawler-repository";
import { PlaywrightCrawlerService } from "@/lib/services/playwright-crawler";
import { SerperService } from "@/lib/services/serper-service";
import { isHostnameExcluded, uniqueByDomain } from "@/lib/utils/crawler-filters";
import { isForumPost, isLoginGatedContent } from "@/lib/utils/forum-url-filter";

async function isJobCancelled(repo: CrawlerRepository, jobId: string) {
  const job = await repo.getJob(jobId);
  return job?.status === "cancelled";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitWhilePaused(repo: CrawlerRepository, jobId: string) {
  let logged = false;

  while (true) {
    const job = await repo.getJob(jobId);
    if (!job || job.status === "cancelled") return false;
    if (job.status !== "paused") return true;

    if (!logged) {
      await repo.addLog(jobId, "Job dang tam dung. Cho nhan Tiep tuc...", "warn");
      logged = true;
    }
    await sleep(1500);
  }
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

    if (!(await waitWhilePaused(repo, jobId))) {
      await repo.addLog(jobId, "Job da dung truoc khi crawl URL.", "warn");
      return;
    }

    if (await isJobCancelled(repo, jobId)) {
      await repo.addLog(jobId, "Job đã dừng trước khi crawl URL.", "warn");
      return;
    }

    // 👉 Lọc bỏ URL forum không phải bài viết
    const forumUrls = found.filter((item) => isForumPost(item.url));
    const filteredUrls = uniqueByDomain(forumUrls, (item) => item.url).slice(0, job.max_urls);

    await repo.updateJob(jobId, { total_urls: filteredUrls.length });
    await repo.addLog(
      jobId,
      `Serper: ${found.length} domain sau lọc. Crawl ${filteredUrls.length} domain duy nhất${forumUrls.length > filteredUrls.length ? ` (giới hạn max ${job.max_urls}, bỏ ${forumUrls.length - filteredUrls.length} domain/URL trùng)` : ""}.`,
    );

    let success = 0;
    let failed = 0;
    let processed = 0;

    for (const item of filteredUrls) {
      if (!(await waitWhilePaused(repo, jobId))) {
        await repo.addLog(jobId, `Dung crawl sau ${processed}/${filteredUrls.length} URL.`, "warn");
        return;
      }

      if (await isJobCancelled(repo, jobId)) {
        await repo.addLog(jobId, `Dừng crawl sau ${processed}/${filteredUrls.length} URL.`, "warn");
        return;
      }

      await repo.addLog(jobId, `Crawl ${item.url}`);
      const result = await crawler.crawl(item);

      if (isHostnameExcluded(result.domain, excludeDomains)) {
        await repo.addLog(jobId, `Skipped (excluded domain): ${result.domain}`, "warn");
        processed += 1;
        await repo.updateJob(jobId, { processed_urls: processed });
        continue;
      }

      // 👉 Bỏ qua trang yêu cầu đăng nhập
      if (result.html_snippet && isLoginGatedContent(result.html_snippet)) {
        await repo.addLog(jobId, `Skipped (login required): ${item.url}`);
        processed += 1;
        failed += 1;
        await repo.updateJob(jobId, {
          processed_urls: processed,
          success_count: success,
          failed_count: failed,
        });
        continue;
      }

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
