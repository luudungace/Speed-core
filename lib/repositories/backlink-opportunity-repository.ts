import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  BacklinkProjectRow,
  BacklinkProjectCompetitorRow,
  BacklinkOpportunityJobRow,
  BacklinkOpportunityJobLogRow,
  BacklinkSourceLinkRow,
  BacklinkOpportunityRow,
  BacklinkOpportunityFilters,
} from "@/lib/types/backlink-opportunity";

export class BacklinkOpportunityRepository {
  private db = createSupabaseAdmin();

  // --- PROJECTS ---

  async createProject(input: { name: string; myDomain: string; competitors: string[] }): Promise<BacklinkProjectRow> {
    // 1. Insert project
    const { data: project, error: projectError } = await this.db
      .from("backlink_projects")
      .insert({
        name: input.name.trim(),
        my_domain: input.myDomain.trim().toLowerCase(),
      })
      .select("*")
      .single();

    if (projectError) throw projectError;

    // 2. Insert competitors
    if (input.competitors && input.competitors.length > 0) {
      await this.replaceCompetitors(project.id, input.competitors);
    }

    return project as BacklinkProjectRow;
  }

  async updateProject(id: string, input: { name?: string; myDomain?: string }): Promise<BacklinkProjectRow> {
    const patch: Record<string, any> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.myDomain !== undefined) patch.my_domain = input.myDomain.trim().toLowerCase();
    patch.updated_at = new Date().toISOString();

    const { data, error } = await this.db
      .from("backlink_projects")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data as BacklinkProjectRow;
  }

  async getProject(id: string): Promise<BacklinkProjectRow | null> {
    const { data, error } = await this.db
      .from("backlink_projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data as BacklinkProjectRow | null;
  }

  async listProjects(): Promise<BacklinkProjectRow[]> {
    const { data, error } = await this.db
      .from("backlink_projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as BacklinkProjectRow[];
  }

  async deleteProject(id: string): Promise<void> {
    const { error } = await this.db
      .from("backlink_projects")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  async replaceCompetitors(projectId: string, competitors: string[]): Promise<void> {
    // Delete existing
    const { error: deleteError } = await this.db
      .from("backlink_project_competitors")
      .delete()
      .eq("project_id", projectId);

    if (deleteError) throw deleteError;

    // Insert new
    if (competitors.length > 0) {
      const inserts = competitors.map((domain) => ({
        project_id: projectId,
        domain: domain.trim().toLowerCase(),
      }));

      const { error: insertError } = await this.db
        .from("backlink_project_competitors")
        .insert(inserts);

      if (insertError) throw insertError;
    }
  }

  async listCompetitors(projectId: string): Promise<BacklinkProjectCompetitorRow[]> {
    const { data, error } = await this.db
      .from("backlink_project_competitors")
      .select("*")
      .eq("project_id", projectId)
      .order("domain", { ascending: true });

    if (error) throw error;
    return (data ?? []) as BacklinkProjectCompetitorRow[];
  }

  // --- JOBS ---

  async createJob(projectId: string, metadata: Record<string, any> = {}): Promise<BacklinkOpportunityJobRow> {
    const { data, error } = await this.db
      .from("backlink_opportunity_jobs")
      .insert({
        project_id: projectId,
        status: "queued",
        metadata,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as BacklinkOpportunityJobRow;
  }

  async updateJob(id: string, patch: Partial<BacklinkOpportunityJobRow>): Promise<void> {
    const { error } = await this.db
      .from("backlink_opportunity_jobs")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
  }

  async getJob(id: string): Promise<BacklinkOpportunityJobRow | null> {
    const { data, error } = await this.db
      .from("backlink_opportunity_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data as BacklinkOpportunityJobRow | null;
  }

  async listJobs(projectId: string, limit = 50): Promise<BacklinkOpportunityJobRow[]> {
    const { data, error } = await this.db
      .from("backlink_opportunity_jobs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as BacklinkOpportunityJobRow[];
  }

  async addLog(jobId: string, message: string, level: "info" | "warn" | "error" = "info", payload: Record<string, any> = {}): Promise<void> {
    const { error } = await this.db
      .from("backlink_opportunity_job_logs")
      .insert({
        job_id: jobId,
        level,
        message,
        payload,
      });

    if (error) throw error;
  }

  async getJobLogs(jobId: string): Promise<BacklinkOpportunityJobLogRow[]> {
    const { data, error } = await this.db
      .from("backlink_opportunity_job_logs")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })
      .limit(1000);

    if (error) throw error;
    return (data ?? []) as BacklinkOpportunityJobLogRow[];
  }

  // --- SOURCES ---

  async upsertSourceLink(input: Omit<BacklinkSourceLinkRow, "id" | "created_at">): Promise<void> {
    const { error } = await this.db
      .from("backlink_source_links")
      .upsert(
        {
          project_id: input.project_id,
          competitor_domain: input.competitor_domain,
          source_url: input.source_url,
          source_domain: input.source_domain,
          target_url: input.target_url,
          is_active: input.is_active,
          first_seen: input.first_seen,
          last_seen: input.last_seen,
          raw_data: input.raw_data,
        },
        { onConflict: "project_id,competitor_domain,source_url" }
      );

    if (error) throw error;
  }

  async listSourceLinksForProject(projectId: string): Promise<BacklinkSourceLinkRow[]> {
    const { data, error } = await this.db
      .from("backlink_source_links")
      .select("*")
      .eq("project_id", projectId);

    if (error) throw error;
    return (data ?? []) as BacklinkSourceLinkRow[];
  }

  async getUniqueSourceUrls(projectId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from("backlink_source_links")
      .select("source_url")
      .eq("project_id", projectId);

    if (error) throw error;
    const urls = (data ?? []).map((row) => row.source_url);
    return [...new Set(urls)];
  }

  // --- OPPORTUNITIES ---

  async upsertOpportunity(input: Omit<BacklinkOpportunityRow, "id" | "created_at" | "updated_at">): Promise<void> {
    const { error } = await this.db
      .from("backlink_opportunities")
      .upsert(
        {
          project_id: input.project_id,
          job_id: input.job_id,
          source_url: input.source_url,
          source_domain: input.source_domain,
          title: input.title,
          cms_type: input.cms_type,
          site_type: input.site_type,
          score: input.score,
          competitor_count: input.competitor_count,
          competitors: input.competitors,
          registration_urls: input.registration_urls,
          login_urls: input.login_urls,
          submit_urls: input.submit_urls,
          profile_urls: input.profile_urls,
          emails: input.emails,
          phones: input.phones,
          crawl_status: input.crawl_status,
          error: input.error,
          crawl_time: input.crawl_time,
          html_snippet: input.html_snippet,
          raw_candidate: input.raw_candidate,
          raw_crawl_data: input.raw_crawl_data,
          last_crawled_at: input.last_crawled_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,source_url" }
      );

    if (error) throw error;
  }

  async listOpportunities(params: BacklinkOpportunityFilters): Promise<{ rows: BacklinkOpportunityRow[]; count: number }> {
    let query = this.db
      .from("backlink_opportunities")
      .select("*", { count: "exact" })
      .eq("project_id", params.projectId);

    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      query = query.or(`source_url.ilike.${term},source_domain.ilike.${term},title.ilike.${term}`);
    }

    if (params.siteType && params.siteType !== "All Site Types" && params.siteType !== "All") {
      query = query.eq("site_type", params.siteType);
    }

    if (params.cmsType && params.cmsType !== "All CMS" && params.cmsType !== "All") {
      query = query.eq("cms_type", params.cmsType);
    }

    if (params.minScore !== undefined && params.minScore > 0) {
      query = query.gte("score", params.minScore);
    }

    if (params.minCompetitorCount !== undefined && params.minCompetitorCount > 0) {
      query = query.gte("competitor_count", params.minCompetitorCount);
    }

    // Filter by presence of specific URLs in jsonb arrays (non-empty arrays)
    if (params.hasRegistration) {
      query = query.neq("registration_urls", "[]");
    }
    if (params.hasSubmit) {
      query = query.neq("submit_urls", "[]");
    }
    if (params.hasProfile) {
      query = query.neq("profile_urls", "[]");
    }

    // Pagination
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Sorting: default competitor_count desc, score desc, created_at desc
    const { data, error, count } = await query
      .order("competitor_count", { ascending: false })
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return {
      rows: (data ?? []) as BacklinkOpportunityRow[],
      count: count ?? 0,
    };
  }

  async getOpportunity(id: string): Promise<BacklinkOpportunityRow | null> {
    const { data, error } = await this.db
      .from("backlink_opportunities")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data as BacklinkOpportunityRow | null;
  }

  async deleteOpportunities(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await this.db
      .from("backlink_opportunities")
      .delete()
      .in("id", ids);

    if (error) throw error;
  }
}
