import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { CrawlJobRow, CrawlLogRow, CrawlResultRow, CrawledUrlResult } from "@/lib/types/crawler";
import { getCrawlerRegisterLink } from "@/lib/utils/auth-links";
import { isHostnameExcluded, uniqueByDomain } from "@/lib/utils/crawler-filters";

function normalizeCrawlJob(row: Record<string, unknown>): CrawlJobRow {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const status = meta.pause_requested === true && row.status === "running" ? "paused" : row.status;
  return {
    ...(row as CrawlJobRow),
    status: status as CrawlJobRow["status"],
    name: (row.name as string | null) ?? (meta.name as string | null) ?? null,
    max_urls: Number(row.max_urls ?? meta.max_urls ?? 500),
    exclude_domains: Array.isArray(row.exclude_domains)
      ? (row.exclude_domains as string[])
      : Array.isArray(meta.exclude_domains)
        ? (meta.exclude_domains as string[])
        : [],
  };
}

export type ListResultsParams = {
  search?: string;
  cms?: string;
  page?: number;
  pageSize?: number;
  status?: CrawlResultRow["status"] | "other";
  registerFilter?: "all" | "with" | "without";
  urlDepth?: string;
  jobId?: string;
  excludeDomains?: string[];
  dedupeByDomain?: boolean;
};

export class CrawlerRepository {
  private db = createSupabaseAdmin();

  async createJob(input: {
    dorks: string[];
    pagesPerDork: number;
    name: string | null;
    maxUrls: number;
    excludeDomains: string[];
  }): Promise<CrawlJobRow> {
    const { data, error } = await this.db
      .from("crawl_jobs")
      .insert({
        name: input.name,
        dorks: input.dorks,
        pages_per_dork: input.pagesPerDork,
        max_urls: input.maxUrls,
        exclude_domains: input.excludeDomains,
        status: "queued",
        metadata: {
          name: input.name,
          max_urls: input.maxUrls,
          exclude_domains: input.excludeDomains,
        },
      })
      .select("*")
      .single();

    if (error) throw error;
    return normalizeCrawlJob(data as Record<string, unknown>);
  }

  async updateJob(id: string, patch: Partial<CrawlJobRow>) {
    const { error } = await this.db
      .from("crawl_jobs")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  async getJob(id: string): Promise<CrawlJobRow | null> {
    const { data, error } = await this.db.from("crawl_jobs").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? normalizeCrawlJob(data as Record<string, unknown>) : null;
  }

  async listJobs(limit = 20): Promise<CrawlJobRow[]> {
    const { data, error } = await this.db
      .from("crawl_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => normalizeCrawlJob(row as Record<string, unknown>));
  }

  async addLog(jobId: string, message: string, level: CrawlLogRow["level"] = "info", payload: Record<string, unknown> = {}) {
    const { error } = await this.db.from("crawl_job_logs").insert({ job_id: jobId, level, message, payload });
    if (error) throw error;
  }

  async getJobLogs(jobId: string): Promise<CrawlLogRow[]> {
    const { data, error } = await this.db
      .from("crawl_job_logs")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    return (data ?? []) as CrawlLogRow[];
  }

  async listResultDomainsForJob(jobId: string, limit = 2000) {
    const { data, error } = await this.db
      .from("crawl_results")
      .select("domain,url")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Array<{ domain: string; url: string }>;
  }

  async upsertResult(jobId: string, result: CrawledUrlResult) {
    const { error } = await this.db.from("crawl_results").upsert(
      {
        ...result,
        job_id: jobId,
      },
      { onConflict: "url" },
    );
    if (error) throw error;
  }

async listResults({
    search = "",
    cms = "All CMS",
    page = 1,
    pageSize = 20,
    status,
    registerFilter = "all",
    urlDepth = "Tất cả URL",
    jobId,
    excludeDomains = [],
    dedupeByDomain = true,
  }: ListResultsParams) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = this.db.from("crawl_results").select("*", { count: "exact" });

    if (jobId) query = query.eq("job_id", jobId);
    if (status === "other") query = query.neq("status", "success");
    else if (status) query = query.eq("status", status);
    if (cms && cms !== "All CMS") query = query.eq("cms_type", cms);
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`url.ilike.${term},domain.ilike.${term},title.ilike.${term}`);
    }

    // ===== FILTER THEO URL DEPTH =====
    if (urlDepth === "Chỉ domain") {
      query = query.filter("url", "match", "^https?://[^/]+/?$");
    } else if (urlDepth === "Domain + 1 path") {
      query = query.filter("url", "match", "^https?://[^/]+/[^/]+/?$");
    } else if (urlDepth === "URL sâu (bài viết)") {
      query = query.not("url", "match", "^https?://[^/]+/?$").not("url", "match", "^https?://[^/]+/[^/]+/?$");
    }
    // ===== END FILTER =====

    const { data, error } = await query.order("created_at", { ascending: false }).range(0, 1999);
    if (error) throw error;
    const visibleRows = ((data ?? []) as CrawlResultRow[]).filter(
      (row) => !isHostnameExcluded(row.domain || row.url, excludeDomains),
    );
    const registerFilteredRows = visibleRows.filter((row) => {
      if (registerFilter === "all") return true;
      const hasRegister = Boolean(getCrawlerRegisterLink({ url: row.url, domain: row.domain, cmsType: row.cms_type }));
      return registerFilter === "with" ? hasRegister : !hasRegister;
    });
    const rows = dedupeByDomain ? uniqueByDomain(registerFilteredRows, (row) => row.domain || row.url) : registerFilteredRows;
    return { rows: rows.slice(from, to + 1), count: rows.length };
  }

  async deleteResults(ids: string[]) {
    const { error } = await this.db.from("crawl_results").delete().in("id", ids);
    if (error) throw error;
  }
}
