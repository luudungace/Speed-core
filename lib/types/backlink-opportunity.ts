import type { CmsType } from "./crawler";

export type BacklinkOpportunityJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type BacklinkProjectRow = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  my_domain: string;
};

export type BacklinkProjectCompetitorRow = {
  id: string;
  created_at: string;
  project_id: string;
  domain: string;
};

export type BacklinkOpportunityJobRow = {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  status: BacklinkOpportunityJobStatus;
  total_sources: number;
  processed_sources: number;
  success_count: number;
  failed_count: number;
  error: string | null;
  metadata: Record<string, any>;
};

export type BacklinkOpportunityJobLogRow = {
  id: string;
  created_at: string;
  job_id: string;
  level: "info" | "warn" | "error";
  message: string;
  payload: Record<string, any>;
};

export type BacklinkSourceLinkRow = {
  id: string;
  created_at: string;
  project_id: string;
  competitor_domain: string;
  source_url: string;
  source_domain: string;
  target_url: string | null;
  is_active: boolean | null;
  first_seen: string | null;
  last_seen: string | null;
  raw_data: Record<string, any>;
};

export type BacklinkOpportunityRow = {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  job_id: string | null;
  source_url: string;
  source_domain: string;
  title: string | null;
  cms_type: CmsType;
  site_type: string;
  score: number;
  competitor_count: number;
  competitors: string[];
  registration_urls: { url: string; text: string }[];
  login_urls: { url: string; text: string }[];
  submit_urls: { url: string; text: string }[];
  profile_urls: { url: string; text: string }[];
  emails: { value: string; source: string }[];
  phones: { value: string; source: string }[];
  crawl_status: "pending" | "success" | "failed";
  error: string | null;
  crawl_time: number;
  html_snippet: string | null;
  raw_candidate: Record<string, any>;
  raw_crawl_data: Record<string, any>;
  last_crawled_at: string | null;
};

export type BacklinkOpportunityFilters = {
  projectId: string;
  search?: string;
  siteType?: string;
  cmsType?: string;
  minScore?: number;
  minCompetitorCount?: number;
  hasRegistration?: boolean;
  hasSubmit?: boolean;
  hasProfile?: boolean;
  page?: number;
  pageSize?: number;
};

export type CreateBacklinkProjectInput = {
  name: string;
  myDomain: string;
  competitors: string[];
};

export type StartBacklinkOpportunityJobInput = {
  projectId: string;
  sourceLimit?: number;
  excludeDomains?: string[];
};
