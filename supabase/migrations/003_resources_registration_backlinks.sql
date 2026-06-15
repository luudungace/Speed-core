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
