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

-- Create registration_jobs table
create table if not exists registration_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  url text not null unique,
  cms_type text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'success', 'failed', 'cancelled')),
  username text null,
  password text null,
  email_used text null,
  proxy_used text null,
  persona_used uuid null references personas(id) on delete set null,
  error text null
);

-- Create posted_backlinks table
create table if not exists posted_backlinks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  forum_url text not null,
  posted_url text not null unique,
  status text not null default 'success' check (status in ('success', 'failed')),
  posted_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

-- Indexes for optimal performance
create index if not exists idx_emails_status on emails(status);
create index if not exists idx_proxies_status on proxies(status);
create index if not exists idx_registration_jobs_status on registration_jobs(status);
create index if not exists idx_posted_backlinks_posted_at on posted_backlinks(posted_at desc);

-- Enable RLS for all tables
alter table emails enable row level security;
alter table proxies enable row level security;
alter table personas enable row level security;
alter table registration_jobs enable row level security;
alter table posted_backlinks enable row level security;

-- Admin/Service Role policies
drop policy if exists "service role emails" on emails;
drop policy if exists "service role proxies" on proxies;
drop policy if exists "service role personas" on personas;
drop policy if exists "service role registration_jobs" on registration_jobs;
drop policy if exists "service role posted_backlinks" on posted_backlinks;

create policy "service role emails" on emails for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role proxies" on proxies for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role personas" on personas for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role registration_jobs" on registration_jobs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role posted_backlinks" on posted_backlinks for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
