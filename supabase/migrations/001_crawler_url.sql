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
