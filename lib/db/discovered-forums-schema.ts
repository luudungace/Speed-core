import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

let publishDateColumnAvailable: boolean | null = null;

export async function discoveredForumsHasPublishDateColumn(db?: SupabaseClient) {
  if (publishDateColumnAvailable !== null) return publishDateColumnAvailable;

  const client = db ?? createSupabaseAdmin();
  const { error } = await client.from("discovered_forums").select("publish_date").limit(1);
  publishDateColumnAvailable = !error?.message?.includes("publish_date");
  return publishDateColumnAvailable;
}

export function resetDiscoveredForumsSchemaCache() {
  publishDateColumnAvailable = null;
}
