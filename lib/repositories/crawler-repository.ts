import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { CrawlJobRow, CrawlLogRow, CrawlResultRow, CrawledUrlResult } from "@/lib/types/crawler";

export type ListResultsParams = {
  search?: string;
  cms?: string;
  page?: number;
  pageSize?: number;
};

export class CrawlerRepository {
  private db = createSupabaseAdmin();

  async createJob(dorks: string[], pagesPerDork: number): Promise<CrawlJobRow> {
    const { data, error } = await this.db
      .from("crawl_jobs")
      .insert({ dorks, pages_per_dork: pagesPerDork, status: "queued" })
      .select("*")
      .single();

    if (error) throw error;
    return data as CrawlJobRow;
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
    return data as CrawlJobRow | null;
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

  async listResults({ search = "", cms = "All CMS", page = 1, pageSize = 20 }: ListResultsParams) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = this.db.from("crawl_results").select("*", { count: "exact" });

    if (cms && cms !== "All CMS") query = query.eq("cms_type", cms);
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`url.ilike.${term},domain.ilike.${term},title.ilike.${term}`);
    }

    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
    if (error) throw error;
    return { rows: (data ?? []) as CrawlResultRow[], count: count ?? 0 };
  }

  async deleteResults(ids: string[]) {
    const { error } = await this.db.from("crawl_results").delete().in("id", ids);
    if (error) throw error;
  }
}
