import { discoveredForumsHasPublishDateColumn } from "@/lib/db/discovered-forums-schema";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { DorkProjectRow, DorkJobRow, DiscoveredForumRow } from "../types/dork-scraper";

export class DorkScraperRepository {
  private db = createSupabaseAdmin();

  // --- PROJECTS ---

  async createProject(input: { name: string; keywords: string[]; dorks: string[]; exclude_domains: string[] }): Promise<DorkProjectRow> {
    const { data, error } = await this.db
      .from("dork_projects")
      .insert({
        name: input.name,
        keywords: input.keywords,
        dorks: input.dorks,
        exclude_domains: input.exclude_domains,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as DorkProjectRow;
  }

  async updateProject(id: string, input: { name: string; keywords: string[]; dorks: string[]; exclude_domains: string[] }): Promise<DorkProjectRow> {
    const { data, error } = await this.db
      .from("dork_projects")
      .update({
        name: input.name,
        keywords: input.keywords,
        dorks: input.dorks,
        exclude_domains: input.exclude_domains,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data as DorkProjectRow;
  }

  async getProject(id: string): Promise<DorkProjectRow | null> {
    const { data, error } = await this.db
      .from("dork_projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data as DorkProjectRow | null;
  }

  async listProjects(): Promise<DorkProjectRow[]> {
    const { data, error } = await this.db
      .from("dork_projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as DorkProjectRow[];
  }

  async deleteProject(id: string): Promise<void> {
    const { error } = await this.db
      .from("dork_projects")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  // --- JOBS ---

  async createJob(projectId: string): Promise<DorkJobRow> {
    const { data, error } = await this.db
      .from("dork_jobs")
      .insert({
        project_id: projectId,
        status: "queued",
        total_results: 0,
        processed_results: 0,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as DorkJobRow;
  }

  async updateJob(id: string, patch: Partial<DorkJobRow>): Promise<void> {
    const { error } = await this.db
      .from("dork_jobs")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
  }

  async getJob(id: string): Promise<DorkJobRow | null> {
    const { data, error } = await this.db
      .from("dork_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data as DorkJobRow | null;
  }

  async listJobs(projectId: string, limit = 10): Promise<DorkJobRow[]> {
    const { data, error } = await this.db
      .from("dork_jobs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as DorkJobRow[];
  }

  // --- DISCOVERED FORUMS ---

  async upsertDiscoveredForum(input: {
    project_id: string;
    domain: string;
    source_url: string;
    title?: string | null;
    cms_type?: string;
    score?: number;
    publish_date?: string | null;
  }): Promise<void> {
    const payload: Record<string, unknown> = {
      project_id: input.project_id,
      domain: input.domain,
      source_url: input.source_url,
      title: input.title || null,
      cms_type: input.cms_type || "Unknown",
      score: input.score || 0,
      status: "discovered",
      updated_at: new Date().toISOString(),
    };

    if (await discoveredForumsHasPublishDateColumn(this.db)) {
      payload.publish_date = input.publish_date || null;
    }

    const { error } = await this.db
      .from("discovered_forums")
      .upsert(payload, { onConflict: "project_id,domain" });

    if (error) throw error;
  }

  async listDiscoveredForums(params: {
    projectId: string;
    search?: string;
    cmsType?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: DiscoveredForumRow[]; count: number }> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.db
      .from("discovered_forums")
      .select("*", { count: "exact" })
      .eq("project_id", params.projectId);

    if (params.search) {
      query = query.or(`domain.ilike.%${params.search}%,source_url.ilike.%${params.search}%,title.ilike.%${params.search}%`);
    }

    if (params.cmsType && params.cmsType !== "All CMS") {
      query = query.eq("cms_type", params.cmsType);
    }

    if (params.status) {
      query = query.eq("status", params.status);
    }

    const { data, error, count } = await query
      .order("score", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return {
      rows: (data ?? []) as DiscoveredForumRow[],
      count: count ?? 0,
    };
  }

  async updateDiscoveredForumsStatus(ids: string[], status: 'imported' | 'ignored'): Promise<void> {
    const { error } = await this.db
      .from("discovered_forums")
      .update({ status, updated_at: new Date().toISOString() })
      .in("id", ids);

    if (error) throw error;
  }

  async deleteDiscoveredForums(ids: string[]): Promise<void> {
    const { error } = await this.db
      .from("discovered_forums")
      .delete()
      .in("id", ids);

    if (error) throw error;
  }
}
