export interface PostedBacklinkRow {
  id: string;
  created_at: string;
  forum_url: string;
  posted_url: string;
  status: "success" | "failed";
  posted_at: string;
  details: Record<string, unknown>;
}
