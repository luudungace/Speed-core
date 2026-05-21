export type CmsType = "XenForo" | "WordPress" | "vBulletin" | "phpBB" | "Unknown";
export type CrawlStatus = "success" | "failed";
export type CrawlJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type SerperResult = {
  url: string;
  title?: string;
  snippet?: string;
  position?: number;
  raw: Record<string, unknown>;
};

export type ContactItem = {
  value: string;
  source: "html" | "text";
};

export type CrawledUrlResult = {
  url: string;
  domain: string;
  title: string | null;
  cms_type: CmsType;
  emails: ContactItem[];
  phones: ContactItem[];
  status: CrawlStatus;
  error: string | null;
  crawl_time: number;
  html_snippet: string | null;
  raw_serper_data: Record<string, unknown>;
};

export type CrawlResultRow = CrawledUrlResult & {
  id: string;
  created_at: string;
  job_id: string | null;
};

export type CrawlJobRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: CrawlJobStatus;
  dorks: string[];
  pages_per_dork: number;
  total_urls: number;
  processed_urls: number;
  success_count: number;
  failed_count: number;
  error: string | null;
  metadata: Record<string, unknown>;
};

export type CrawlLogRow = {
  id: string;
  created_at: string;
  job_id: string;
  level: "info" | "warn" | "error";
  message: string;
  payload: Record<string, unknown>;
};
