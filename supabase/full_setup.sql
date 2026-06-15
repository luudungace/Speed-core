-- ==========================================
-- FULL SETUP SQL FOR SPEED-CORE DATABASE
-- Generated automatically to set up all tables and restore emails
-- ==========================================

-- >>> START OF MIGRATION: 000_apply_crawler.sql <<<
create extension if not exists "pgcrypto";

do $$ begin
  create type crawl_job_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type crawl_result_status as enum ('success', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status crawl_job_status not null default 'queued',
  dorks text[] not null default '{}',
  pages_per_dork integer not null default 2 check (pages_per_dork between 1 and 10),
  total_urls integer not null default 0,
  processed_urls integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  error text null,
  metadata jsonb not null default '{}'::jsonb,
  name text,
  max_urls integer not null default 500 check (max_urls between 10 and 2000),
  exclude_domains text[] not null default '{}'
);

create table if not exists crawl_job_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid not null references crawl_jobs(id) on delete cascade,
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  message text not null,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists crawl_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid references crawl_jobs(id) on delete set null,
  url text not null unique,
  domain text not null,
  title text,
  cms_type text not null default 'Unknown',
  emails jsonb[] not null default '{}',
  phones jsonb[] not null default '{}',
  status crawl_result_status not null,
  error text,
  crawl_time double precision not null default 0,
  html_snippet text,
  raw_serper_data jsonb not null default '{}'::jsonb
);

alter table crawl_jobs
  add column if not exists name text,
  add column if not exists max_urls integer not null default 500 check (max_urls between 10 and 2000),
  add column if not exists exclude_domains text[] not null default '{}';

create index if not exists idx_crawl_results_job_id on crawl_results(job_id);
create index if not exists idx_crawl_results_domain on crawl_results(domain);
create index if not exists idx_crawl_results_cms_type on crawl_results(cms_type);
create index if not exists idx_crawl_job_logs_job_id_created_at on crawl_job_logs(job_id, created_at desc);

alter table crawl_jobs enable row level security;
alter table crawl_job_logs enable row level security;
alter table crawl_results enable row level security;

drop policy if exists "service role crawl_jobs" on crawl_jobs;
drop policy if exists "service role crawl_job_logs" on crawl_job_logs;
drop policy if exists "service role crawl_results" on crawl_results;

create policy "service role crawl_jobs" on crawl_jobs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role crawl_job_logs" on crawl_job_logs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role crawl_results" on crawl_results for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- >>> END OF MIGRATION: 000_apply_crawler.sql <<<

-- >>> START OF MIGRATION: 001_crawler_url.sql <<<
create extension if not exists "pgcrypto";

do $$ begin
  create type crawl_job_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type crawl_result_status as enum ('success', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status crawl_job_status not null default 'queued',
  dorks text[] not null default '{}',
  pages_per_dork integer not null default 2 check (pages_per_dork between 1 and 10),
  total_urls integer not null default 0,
  processed_urls integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  error text null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists crawl_job_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid not null references crawl_jobs(id) on delete cascade,
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  message text not null,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists crawl_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid references crawl_jobs(id) on delete set null,
  url text not null unique,
  domain text not null,
  title text,
  cms_type text not null default 'Unknown',
  emails jsonb[] not null default '{}',
  phones jsonb[] not null default '{}',
  status crawl_result_status not null,
  error text,
  crawl_time double precision not null default 0,
  html_snippet text,
  raw_serper_data jsonb not null default '{}'::jsonb
);

create index if not exists idx_crawl_results_job_id on crawl_results(job_id);
create index if not exists idx_crawl_results_domain on crawl_results(domain);
create index if not exists idx_crawl_results_cms_type on crawl_results(cms_type);
create index if not exists idx_crawl_job_logs_job_id_created_at on crawl_job_logs(job_id, created_at desc);

alter table crawl_jobs enable row level security;
alter table crawl_job_logs enable row level security;
alter table crawl_results enable row level security;

drop policy if exists "service role crawl_jobs" on crawl_jobs;
drop policy if exists "service role crawl_job_logs" on crawl_job_logs;
drop policy if exists "service role crawl_results" on crawl_results;

create policy "service role crawl_jobs" on crawl_jobs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role crawl_job_logs" on crawl_job_logs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role crawl_results" on crawl_results for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- >>> END OF MIGRATION: 001_crawler_url.sql <<<

-- >>> START OF MIGRATION: 002_crawler_job_options.sql <<<
alter table crawl_jobs
  add column if not exists name text,
  add column if not exists max_urls integer not null default 500 check (max_urls between 10 and 2000),
  add column if not exists exclude_domains text[] not null default '{}';

-- >>> END OF MIGRATION: 002_crawler_job_options.sql <<<

-- >>> START OF MIGRATION: 002_remove_unverified_opportunity_fields.sql <<<
drop index if exists idx_crawl_results_site_type;
drop index if exists idx_crawl_results_can_profile_link;
drop index if exists idx_crawl_results_can_post;
drop index if exists idx_crawl_results_can_register;

alter table crawl_results
  drop column if exists site_type,
  drop column if exists can_register,
  drop column if exists can_post,
  drop column if exists can_profile_link,
  drop column if exists opportunity_confidence,
  drop column if exists opportunity_reasons;

-- >>> END OF MIGRATION: 002_remove_unverified_opportunity_fields.sql <<<

-- >>> START OF MIGRATION: 003_resources_registration_backlinks.sql <<<
-- Create emails pool table
create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null unique,
  password text not null,
  imap_host text not null default 'imap.gmail.com',
  imap_port integer not null default 993,
  status text not null default 'available' check (status in ('available', 'locked', 'used')),
  locked_at timestamptz null
);

-- Create proxies pool table
create table if not exists proxies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  host text not null,
  port integer not null,
  username text null,
  password text null,
  type text not null default 'Residential' check (type in ('Residential', 'Datacenter')),
  status text not null default 'available' check (status in ('available', 'locked', 'dead')),
  locked_at timestamptz null,
  unique (host, port)
);

-- Create personas table
create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text not null,
  username_base text not null,
  bio text null,
  gender text null,
  country text null
);

-- Create registration_queue table
create table if not exists registration_queue (
  url text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text null,
  rating text not null default '',
  score integer not null default 0,
  site_type text not null default '',
  email text null,
  username text not null default '',
  password text null,
  status text not null default 'Không xác định',
  note text null
);

-- Create registered_accounts table
create table if not exists registered_accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  url text not null,
  domain text not null,
  email text not null,
  username text not null,
  password text not null,
  note text null,
  email_verification_status text null,
  email_verification_note text null,
  email_verified_at timestamptz null,
  unique (url, email, username)
);

-- Create posted_backlinks table
create table if not exists posted_backlinks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  forum_url text not null,
  posted_url text not null unique,
  status text not null default 'success' check (status in ('success', 'failed')),
  posted_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb,
  is_alive boolean default true,
  last_checked_at timestamptz default null
);

-- Indexes for optimal performance
create index if not exists idx_emails_status on emails(status);
create index if not exists idx_proxies_status on proxies(status);
create index if not exists idx_registration_queue_status on registration_queue(status);
create index if not exists idx_registered_accounts_domain on registered_accounts(domain);
create index if not exists idx_posted_backlinks_posted_at on posted_backlinks(posted_at desc);

-- Enable RLS for all tables
alter table emails enable row level security;
alter table proxies enable row level security;
alter table personas enable row level security;
alter table registration_queue enable row level security;
alter table registered_accounts enable row level security;
alter table posted_backlinks enable row level security;

-- Admin/Service Role policies
drop policy if exists "service role emails" on emails;
drop policy if exists "service role proxies" on proxies;
drop policy if exists "service role personas" on personas;
drop policy if exists "service role registration_queue" on registration_queue;
drop policy if exists "service role registered_accounts" on registered_accounts;
drop policy if exists "service role posted_backlinks" on posted_backlinks;

create policy "service role emails" on emails for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role proxies" on proxies for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role personas" on personas for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role registration_queue" on registration_queue for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role registered_accounts" on registered_accounts for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role posted_backlinks" on posted_backlinks for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- >>> END OF MIGRATION: 003_resources_registration_backlinks.sql <<<

-- >>> START OF MIGRATION: 004_backlink_opportunities.sql <<<
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

-- >>> END OF MIGRATION: 004_backlink_opportunities.sql <<<

-- >>> RESTORE EMAILS DATA <<<
INSERT INTO emails (id, created_at, updated_at, email, password, imap_host, imap_port, status, locked_at)
VALUES ('74cec886-8552-4223-b78b-9948bf70ab4d', '2026-06-13T09:38:28.998413+00:00', '2026-06-14T16:19:23.959+00:00', 'arun1959mol@gmail.com', 'Google123@', 'imap.gmail.com', 993, 'available', NULL)
ON CONFLICT (email) DO NOTHING;
INSERT INTO emails (id, created_at, updated_at, email, password, imap_host, imap_port, status, locked_at)
VALUES ('f61ad945-c9c6-4889-ad53-67cffa371c45', '2026-06-13T09:38:28.842192+00:00', '2026-06-14T16:19:23.959+00:00', 'mama0874160121@gmail.com', 'Google123@', 'imap.gmail.com', 993, 'available', NULL)
ON CONFLICT (email) DO NOTHING;
INSERT INTO emails (id, created_at, updated_at, email, password, imap_host, imap_port, status, locked_at)
VALUES ('954c120d-82ad-46e6-a2b9-2d0a0fc8f67c', '2026-06-13T09:38:28.692036+00:00', '2026-06-14T16:19:23.959+00:00', 'onghyr44@gmail.com', 'Google123@', 'imap.gmail.com', 993, 'available', NULL)
ON CONFLICT (email) DO NOTHING;
INSERT INTO emails (id, created_at, updated_at, email, password, imap_host, imap_port, status, locked_at)
VALUES ('bf658598-8017-44e7-be04-46dd811e19b8', '2026-06-13T09:38:28.530724+00:00', '2026-06-14T16:19:23.959+00:00', 'sumsung0617568696@gmail.com', 'Google123@', 'imap.gmail.com', 993, 'available', NULL)
ON CONFLICT (email) DO NOTHING;
-- >>> END OF RESTORE EMAILS DATA <<<
