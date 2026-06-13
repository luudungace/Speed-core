import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { CrawlJobRow, CrawlLogRow, CrawlResultRow, CrawledUrlResult } from "@/lib/types/crawler";
import type { CrawlerRegisterFilter } from "@/lib/utils/crawler-url-view-state";
import { hasCrawlerRegisterLink } from "@/lib/utils/crawler-register-link";
import { getBacklinkCandidateFromRaw } from "@/lib/utils/backlink-candidate";
import { matchesUrlDepth, type UrlDepthFilter } from "@/lib/utils/forum-url-filter";

function normalizeCrawlJob(row: Record<string, unknown>): CrawlJobRow {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    ...(row as CrawlJobRow),
    name: (row.name as string | null) ?? (meta.name as string | null) ?? null,
    max_urls: Number(row.max_urls ?? meta.max_urls ?? 500),
    exclude_domains: Array.isArray(row.exclude_domains)
      ? (row.exclude_domains as string[])
      : Array.isArray(meta.exclude_domains)
        ? (meta.exclude_domains as string[])
        : [],
    backlink_targets: Array.isArray(meta.backlink_targets) ? (meta.backlink_targets as string[]) : [],
    backlink_source_limit: Number(meta.backlink_source_limit ?? 100),
    direct_urls: Array.isArray(meta.direct_urls) ? (meta.direct_urls as string[]) : [],
  };
}

export type ListResultsParams = {
  search?: string;
  cms?: string;
  page?: number;
  pageSize?: number;
  urlDepth?: UrlDepthFilter;
  jobId?: string | null;
  registerFilter?: CrawlerRegisterFilter;
};

const FILTER_BATCH_MAX = 2000;

function needsInMemoryFilter(params: ListResultsParams) {
  const urlDepth = params.urlDepth ?? "all";
  const registerFilter = params.registerFilter ?? "all";
  return urlDepth !== "all" || registerFilter !== "all";
}

function applyRowFilters(rows: CrawlResultRow[], params: ListResultsParams) {
  const urlDepth = params.urlDepth ?? "all";
  const registerFilter = params.registerFilter ?? "all";

  return rows.filter((row) => {
    if (!matchesUrlDepth(row.url, urlDepth)) return false;
    if (registerFilter === "has_register" && !hasCrawlerRegisterLink(row)) return false;
    if (registerFilter === "no_register" && hasCrawlerRegisterLink(row)) return false;
    return true;
  });
}

function chunkUrlsForLookup(urls: string[]) {
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentLength = 0;
  const maxChunkLength = 2500;
  const maxChunkSize = 25;

  for (const url of urls) {
    const nextLength = encodeURIComponent(url).length + 4;
    if (current.length > 0 && (current.length >= maxChunkSize || currentLength + nextLength > maxChunkLength)) {
      chunks.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(url);
    currentLength += nextLength;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

export class CrawlerRepository {
  private db = createSupabaseAdmin();

  async createJob(input: {
    dorks: string[];
    pagesPerDork: number;
    name: string | null;
    maxUrls: number;
    excludeDomains: string[];
    backlinkTargets: string[];
    backlinkSourceLimit: number;
    directUrls?: string[];
  }): Promise<CrawlJobRow> {
    const { data, error } = await this.db
      .from("crawl_jobs")
      .insert({
        dorks: input.dorks,
        pages_per_dork: input.pagesPerDork,
        name: input.name,
        max_urls: input.maxUrls,
        exclude_domains: input.excludeDomains,
        status: "queued",
        metadata: {
          name: input.name,
          max_urls: input.maxUrls,
          exclude_domains: input.excludeDomains,
          backlink_targets: input.backlinkTargets,
          backlink_source_limit: input.backlinkSourceLimit,
          direct_urls: input.directUrls ?? [],
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

  async getExistingUrls(urls: string[]) {
    const uniqueUrls = [...new Set(urls.filter(Boolean))];
    if (uniqueUrls.length === 0) return new Set<string>();

    const existing = new Set<string>();
    for (const chunk of chunkUrlsForLookup(uniqueUrls)) {
      const { data, error } = await this.db.from("crawl_results").select("url").in("url", chunk);
      if (error) throw error;
      for (const row of data ?? []) {
        if (typeof row.url === "string") existing.add(row.url);
      }
    }

    return existing;
  }

  private buildResultsQuery(params: ListResultsParams, withCount: boolean) {
    let query = this.db.from("crawl_results").select("*", withCount ? { count: "exact" } : undefined);

    if (params.cms && params.cms !== "All CMS") query = query.eq("cms_type", params.cms);
    if (params.jobId) query = query.eq("job_id", params.jobId);
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      query = query.or(`url.ilike.${term},domain.ilike.${term},title.ilike.${term}`);
    }

    // Manual-review rows live in the dedicated manual-review table; exclude them here so each page fills PAGE_SIZE.
    query = query.or("error.is.null,error.not.ilike.NEEDS_MANUAL_REVIEW:%");
    return query;
  }

  async listResults(params: ListResultsParams) {
    const search = params.search ?? "";
    const cms = params.cms ?? "All CMS";
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    if (needsInMemoryFilter(params)) {
      const query = this.buildResultsQuery({ ...params, search, cms }, false);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(FILTER_BATCH_MAX);
      if (error) throw error;
      const filtered = applyRowFilters((data ?? []) as CrawlResultRow[], params);
      const from = (page - 1) * pageSize;
      return { rows: filtered.slice(from, from + pageSize), count: filtered.length };
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const query = this.buildResultsQuery({ ...params, search, cms }, true);
    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
    if (error) throw error;
    return { rows: (data ?? []) as CrawlResultRow[], count: count ?? 0 };
  }

  async getResultsByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const { data, error } = await this.db.from("crawl_results").select("*").in("id", ids);
    if (error) throw error;
    return (data ?? []) as CrawlResultRow[];
  }

  async listManualReviewResults({ search = "", page = 1, pageSize = 20 }: Omit<ListResultsParams, "cms">) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = this.db
      .from("crawl_results")
      .select("*", { count: "exact" })
      .eq("status", "failed")
      .ilike("error", "NEEDS_MANUAL_REVIEW:%");

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`url.ilike.${term},domain.ilike.${term},title.ilike.${term}`);
    }

    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
    if (error) throw error;
    return { rows: (data ?? []) as CrawlResultRow[], count: count ?? 0 };
  }

  async listReviewCandidateResults(limit = 1000) {
    const { data, error } = await this.db
      .from("crawl_results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    const rows = ((data ?? []) as CrawlResultRow[]).filter((row) => {
      const candidate = getBacklinkCandidateFromRaw(row.raw_serper_data);
      return candidate ? candidate.score >= 30 && candidate.score < 55 : false;
    });

    return { rows, count: rows.length };
  }

  async deleteResults(ids: string[]) {
    const { error } = await this.db.from("crawl_results").delete().in("id", ids);
    if (error) throw error;
  }
}
