import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { PostedBacklinkRow } from "@/lib/types/backlinks";

export class BacklinkRepository {
  private db = createSupabaseAdmin();

  async listBacklinks(page = 1, pageSize = 20) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await this.db
      .from("posted_backlinks")
      .select("*", { count: "exact" })
      .order("posted_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { rows: (data ?? []) as PostedBacklinkRow[], count: count ?? 0 };
  }

  async addBacklink(input: {
    forumUrl: string;
    postedUrl: string;
    status: "success" | "failed";
    details?: Record<string, unknown>;
  }) {
    const { data, error } = await this.db
      .from("posted_backlinks")
      .insert({
        forum_url: input.forumUrl,
        posted_url: input.postedUrl,
        status: input.status,
        details: input.details || {},
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as PostedBacklinkRow;
  }

  async getAllBacklinksForExport(limit = 2000) {
    const { data, error } = await this.db
      .from("posted_backlinks")
      .select("*")
      .order("posted_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as PostedBacklinkRow[];
  }
}
