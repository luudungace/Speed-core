do $$ begin
  create type registration_url_status as enum ('candidate', 'verified', 'no_register_form', 'manual_review', 'blocked');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type registration_job_state as enum (
    'discover',
    'url_verified',
    'manual_review',
    'awaiting_email',
    'click_verify',
    'set_password',
    'active',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists site_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  domain text not null unique,
  register_url text,
  cms_type text not null default 'Unknown',
  verification_pattern text,
  requires_verification boolean,
  disposable_blocked boolean not null default false,
  cooldown_until timestamptz,
  mail_delay_p95_sec integer,
  last_verified_at timestamptz,
  notes text
);

create table if not exists registration_urls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  domain text not null,
  url text not null unique,
  cms_type text not null default 'Unknown',
  score integer not null default 0,
  status registration_url_status not null default 'candidate',
  verified boolean not null default false,
  final_url text,
  probe_at timestamptz,
  failure_code text,
  evidence jsonb not null default '{}'::jsonb
);

create table if not exists registration_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  domain text not null,
  target_url text not null,
  state registration_job_state not null default 'discover',
  pattern text,
  attempt integer not null default 0,
  submitted_at timestamptz,
  next_poll_at timestamptz,
  verify_link text,
  error_code text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_registration_urls_domain on registration_urls(domain);
create index if not exists idx_registration_urls_status on registration_urls(status);
create index if not exists idx_registration_jobs_domain_state on registration_jobs(domain, state);
create index if not exists idx_site_profiles_domain on site_profiles(domain);

alter table site_profiles enable row level security;
alter table registration_urls enable row level security;
alter table registration_jobs enable row level security;

drop policy if exists "service role site_profiles" on site_profiles;
drop policy if exists "service role registration_urls" on registration_urls;
drop policy if exists "service role registration_jobs" on registration_jobs;

create policy "service role site_profiles" on site_profiles for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role registration_urls" on registration_urls for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role registration_jobs" on registration_jobs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
