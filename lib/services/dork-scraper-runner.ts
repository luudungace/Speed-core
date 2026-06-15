import { SerperDorkScraper } from "./serper-dork-scraper";
import { PlaywrightCrawlerService } from "./playwright-crawler";
import { DorkScraperRepository } from "../repositories/dork-scraper-repository";
import { getDomainFromUrl } from "../utils/domain";
import type { SerperResult } from "@/lib/types/crawler";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

// Map to hold running dork scraper tasks to prevent duplicate concurrent runs
const runningJobs = new Set<string>();

export async function runDorkScraperJob(jobId: string): Promise<void> {
  if (runningJobs.has(jobId)) {
    console.log(`Dork Scraper Job ${jobId} is already running.`);
    return;
  }
  
  runningJobs.add(jobId);
  const repo = new DorkScraperRepository();
  const searcher = new SerperDorkScraper();
  const crawler = new PlaywrightCrawlerService();

  console.log(`Starting Dork Scraper Job ${jobId}`);

  try {
    // 1. Fetch job & project
    const job = await repo.getJob(jobId);
    if (!job) {
      console.error(`Job ${jobId} not found`);
      return;
    }

    if (job.status === "cancelled" || job.status === "completed" || job.status === "failed") {
      console.log(`Job ${jobId} is already in state: ${job.status}`);
      return;
    }

    const project = await repo.getProject(job.project_id);
    if (!project) {
      await repo.updateJob(jobId, { status: "failed", error: "Không tìm thấy dự án tương ứng." });
      return;
    }

    // Set job to running
    await repo.updateJob(jobId, { status: "running" });

    // 2. Generate search queries by combining keywords and dorks
    const queries: string[] = [];
    for (const kw of project.keywords) {
      for (const dork of project.dorks) {
        // If keyword is present, prepend it, e.g. "crypto inurl:viewtopic.php"
        const cleanKw = kw.trim();
        const cleanDork = dork.trim();
        if (cleanKw) {
          queries.push(`${cleanKw} ${cleanDork}`);
        } else {
          queries.push(cleanDork);
        }
      }
    }

    if (queries.length === 0) {
      // If no keywords or dorks, just push the dorks directly if any
      if (project.dorks.length > 0) {
        queries.push(...project.dorks);
      }
    }

    if (queries.length === 0) {
      await repo.updateJob(jobId, { status: "failed", error: "Không có câu lệnh dork hoặc từ khóa chủ đề nào được thiết lập." });
      return;
    }

    // Determine max results from metadata (defaults to 100)
    const maxResults = 1000; // Deep search limit

    // 3. Search and gather unique URLs
    const organicResults: SerperResult[] = [];
    const uniqueDomains = new Set<string>();
    const uniqueSerperResults: SerperResult[] = [];

    // Fetch already registered/imported domains to filter out duplicates cross-runs
    const db = createSupabaseAdmin();
    const registeredDomains = new Set<string>();
    
    // a. Fetch domains in registration_jobs queue
    const { data: existingJobs } = await db
      .from("registration_jobs")
      .select("url");
    if (existingJobs) {
      for (const ej of existingJobs) {
        if (ej.url) {
          registeredDomains.add(getDomainFromUrl(ej.url));
        }
      }
    }

    // b. Fetch domains in registered_accounts table
    const { data: existingAccounts } = await db
      .from("registered_accounts")
      .select("url");
    if (existingAccounts) {
      for (const ea of existingAccounts) {
        if (ea.url) {
          registeredDomains.add(getDomainFromUrl(ea.url));
        }
      }
    }

    // c. Fetch domains already discovered in this project to prevent re-crawling
    const { data: existingForums } = await db
      .from("discovered_forums")
      .select("domain")
      .eq("project_id", project.id);
    const discoveredDomains = new Set<string>();
    if (existingForums) {
      for (const ef of existingForums) {
        if (ef.domain) {
          discoveredDomains.add(ef.domain);
        }
      }
    }

    for (const q of queries) {
      // Check cancellation
      const checkJob = await repo.getJob(jobId);
      if (checkJob?.status === "cancelled") {
        console.log("Job was cancelled by user.");
        return;
      }

      try {
        const results = await searcher.searchDorkDeep(q, maxResults, project.exclude_domains || []);
        for (const res of results) {
          const domain = getDomainFromUrl(res.url);
          if (!domain) continue;
          
          // Deduplicate domains:
          // 1. Within current job run (uniqueDomains)
          // 2. Against existing registration jobs/accounts (registeredDomains)
          // 3. Against already discovered forums in this project (discoveredDomains)
          if (!uniqueDomains.has(domain) && !registeredDomains.has(domain) && !discoveredDomains.has(domain)) {
            uniqueDomains.add(domain);
            uniqueSerperResults.push(res);
          }
        }
      } catch (err: any) {
        console.error(`Error searching query: "${q}":`, err.message);
      }
    }

    const totalResults = uniqueSerperResults.length;
    await repo.updateJob(jobId, { total_results: totalResults });

    console.log(`Discovered ${totalResults} unique forums from Google Dorking.`);

    if (totalResults === 0) {
      await repo.updateJob(jobId, { status: "completed" });
      return;
    }

    // 4. Crawl each domain to analyze its CMS type
    let processed = 0;
    for (const res of uniqueSerperResults) {
      // Check cancellation
      const checkJob = await repo.getJob(jobId);
      if (checkJob?.status === "cancelled") {
        console.log("Job was cancelled by user during crawling.");
        return;
      }

      const domain = getDomainFromUrl(res.url);
      processed++;
      
      try {
        console.log(`[${processed}/${totalResults}] Crawling discovered forum: ${domain}...`);
        
        // Crawl domain home page or the specific search result page
        const crawlResult = await crawler.crawl(res);
        const publishDate = typeof res.raw["date"] === "string" ? res.raw["date"] : null;
        
        // Save to discovered_forums table
        await repo.upsertDiscoveredForum({
          project_id: project.id,
          domain,
          source_url: res.url,
          title: crawlResult.title,
          cms_type: crawlResult.cms_type,
          score: crawlResult.cms_type !== "Unknown" ? 80 : 20, // Assign higher score if CMS is recognized
          publish_date: publishDate,
        });

      } catch (err: any) {
        console.error(`Error crawling domain ${domain}:`, err.message);
        const publishDate = typeof res.raw["date"] === "string" ? res.raw["date"] : null;
        // Save anyway with Unknown CMS
        await repo.upsertDiscoveredForum({
          project_id: project.id,
          domain,
          source_url: res.url,
          title: null,
          cms_type: "Unknown",
          score: 10,
          publish_date: publishDate,
        });
      }

      // Update job progress
      await repo.updateJob(jobId, { processed_results: processed });
    }

    // 5. Complete job
    await repo.updateJob(jobId, { status: "completed" });
    console.log(`🎉 Job Dork Scraper ${jobId} finished successfully!`);

  } catch (err: any) {
    console.error(`Error executing job ${jobId}:`, err);
    await repo.updateJob(jobId, { status: "failed", error: err.message || "Lỗi hệ thống khi cào dork." });
  } finally {
    runningJobs.delete(jobId);
    await crawler.close();
  }
}
