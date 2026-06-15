-- 1. Create backlink_projects table
create table if not exists backlink_projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  my_domain text not null
);

-- 2. Create backlink_project_competitors table
create table if not exists backlink_project_competitors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references backlink_projects(id) on delete cascade,
  domain text not null,
  unique (project_id, domain)
);

-- 3. Create backlink_opportunity_jobs table
create table if not exists backlink_opportunity_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id uuid not null references backlink_projects(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  total_sources integer not null default 0,
  processed_sources integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  error text null,
  metadata jsonb not null default '{}'::jsonb
);

-- 4. Create backlink_opportunity_job_logs table
create table if not exists backlink_opportunity_job_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid not null references backlink_opportunity_jobs(id) on delete cascade,
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  message text not null,
  payload jsonb not null default '{}'::jsonb
);

-- 5. Create backlink_source_links table
create table if not exists backlink_source_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references backlink_projects(id) on delete cascade,
  competitor_domain text not null,
  source_url text not null,
  source_domain text not null,
  target_url text null,
  is_active boolean null,
  first_seen timestamptz null,
  last_seen timestamptz null,
  raw_data jsonb not null default '{}'::jsonb,
  unique (project_id, competitor_domain, source_url)
);

-- 6. Create backlink_opportunities table
create table if not exists backlink_opportunities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id uuid not null references backlink_projects(id) on delete cascade,
  job_id uuid null references backlink_opportunity_jobs(id) on delete set null,
  source_url text not null,
  source_domain text not null,
  title text null,
  cms_type text not null default 'Unknown',
  site_type text not null default 'Unknown',
  score integer not null default 0,
  competitor_count integer not null default 0,
  competitors text[] not null default '{}',
  registration_urls jsonb not null default '[]'::jsonb,
  login_urls jsonb not null default '[]'::jsonb,
  submit_urls jsonb not null default '[]'::jsonb,
  profile_urls jsonb not null default '[]'::jsonb,
  emails jsonb not null default '[]'::jsonb,
  phones jsonb not null default '[]'::jsonb,
  crawl_status text not null default 'pending' check (crawl_status in ('pending', 'success', 'failed')),
  error text null,
  crawl_time double precision not null default 0,
  html_snippet text null,
  raw_candidate jsonb not null default '{}'::jsonb,
  raw_crawl_data jsonb not null default '{}'::jsonb,
  last_crawled_at timestamptz null,
  unique (project_id, source_url)
);

-- Indexes for performance
create index if not exists idx_backlink_project_competitors_project_id on backlink_project_competitors(project_id);
create index if not exists idx_backlink_source_links_project_id on backlink_source_links(project_id);
create index if not exists idx_backlink_source_links_proj_src_dom on backlink_source_links(project_id, source_domain);
create index if not exists idx_backlink_source_links_proj_comp_dom on backlink_source_links(project_id, competitor_domain);
create index if not exists idx_backlink_opportunities_project_id on backlink_opportunities(project_id);
create index if not exists idx_backlink_opportunities_proj_score on backlink_opportunities(project_id, score desc);
create index if not exists idx_backlink_opportunities_proj_comp_count on backlink_opportunities(project_id, competitor_count desc);
create index if not exists idx_backlink_opportunity_jobs_project_id on backlink_opportunity_jobs(project_id);
create index if not exists idx_backlink_opportunity_job_logs_job_id_date on backlink_opportunity_job_logs(job_id, created_at desc);

-- Enable RLS (Row Level Security) for all tables
alter table backlink_projects enable row level security;
alter table backlink_project_competitors enable row level security;
alter table backlink_opportunity_jobs enable row level security;
alter table backlink_opportunity_job_logs enable row level security;
alter table backlink_source_links enable row level security;
alter table backlink_opportunities enable row level security;

-- Service role policies
drop policy if exists "service role backlink_projects" on backlink_projects;
drop policy if exists "service role backlink_project_competitors" on backlink_project_competitors;
drop policy if exists "service role backlink_opportunity_jobs" on backlink_opportunity_jobs;
drop policy if exists "service role backlink_opportunity_job_logs" on backlink_opportunity_job_logs;
drop policy if exists "service role backlink_source_links" on backlink_source_links;
drop policy if exists "service role backlink_opportunities" on backlink_opportunities;

create policy "service role backlink_projects" on backlink_projects for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role backlink_project_competitors" on backlink_project_competitors for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role backlink_opportunity_jobs" on backlink_opportunity_jobs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role backlink_opportunity_job_logs" on backlink_opportunity_job_logs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role backlink_source_links" on backlink_source_links for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role backlink_opportunities" on backlink_opportunities for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
