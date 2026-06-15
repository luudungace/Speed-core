-- 1. Create dork_projects table
create table if not exists dork_projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  keywords text[] not null default '{}',
  dorks text[] not null default '{}',
  exclude_domains text[] not null default '{}'
);

-- 2. Create dork_jobs table
create table if not exists dork_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id uuid not null references dork_projects(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  total_results integer not null default 0,
  processed_results integer not null default 0,
  error text null
);

-- 3. Create discovered_forums table
create table if not exists discovered_forums (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id uuid not null references dork_projects(id) on delete cascade,
  domain text not null,
  source_url text not null,
  title text null,
  cms_type text not null default 'Unknown',
  status text not null default 'discovered' check (status in ('discovered', 'imported', 'ignored')),
  score integer not null default 0,
  publish_date text null,
  unique (project_id, domain)
);

-- Create indexes for performance
create index if not exists idx_dork_jobs_project_id on dork_jobs(project_id);
create index if not exists idx_discovered_forums_project_id on discovered_forums(project_id);
create index if not exists idx_discovered_forums_domain on discovered_forums(domain);
create index if not exists idx_discovered_forums_status on discovered_forums(status);

-- Enable RLS for all tables
alter table dork_projects enable row level security;
alter table dork_jobs enable row level security;
alter table discovered_forums enable row level security;

-- Drop existing service role policies if exist
drop policy if exists "service role dork_projects" on dork_projects;
drop policy if exists "service role dork_jobs" on dork_jobs;
drop policy if exists "service role discovered_forums" on discovered_forums;

-- Create service role policies
create policy "service role dork_projects" on dork_projects for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role dork_jobs" on dork_jobs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role discovered_forums" on discovered_forums for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
