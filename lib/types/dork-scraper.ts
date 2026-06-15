export type DorkProjectRow = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  keywords: string[];
  dorks: string[];
  exclude_domains: string[];
};

export type DorkJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type DorkJobRow = {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  status: DorkJobStatus;
  total_results: number;
  processed_results: number;
  error: string | null;
};

export type DiscoveredForumStatus = 'discovered' | 'imported' | 'ignored';

export type DiscoveredForumRow = {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  domain: string;
  source_url: string;
  title: string | null;
  cms_type: string;
  status: DiscoveredForumStatus;
  score: number;
  publish_date: string | null;
};

export type CreateDorkProjectInput = {
  name: string;
  keywords: string[];
  dorks: string[];
  exclude_domains: string[];
};

export type StartDorkJobInput = {
  projectId: string;
  limit: number;
};
