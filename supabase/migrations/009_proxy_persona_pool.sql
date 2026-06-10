create table if not exists proxy_pool (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  endpoint text not null unique,
  proxy_type text not null default 'residential',
  host text not null,
  port integer not null,
  username text,
  password_value text,
  status resource_pool_status not null default 'available',
  locked_by text,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  last_used_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  constraint proxy_pool_port_valid check (port between 1 and 65535)
);

create index if not exists idx_proxy_pool_status on proxy_pool(status);
create index if not exists idx_proxy_pool_updated_at on proxy_pool(updated_at desc);
create index if not exists idx_proxy_pool_lock_expires_at on proxy_pool(lock_expires_at);

alter table proxy_pool enable row level security;

drop policy if exists "service role proxy_pool" on proxy_pool;
create policy "service role proxy_pool" on proxy_pool for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create table if not exists persona_pool (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text not null,
  username_base text not null unique,
  bio text,
  gender text,
  country text,
  status resource_pool_status not null default 'available',
  locked_by text,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  last_used_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_persona_pool_status on persona_pool(status);
create index if not exists idx_persona_pool_updated_at on persona_pool(updated_at desc);
create index if not exists idx_persona_pool_lock_expires_at on persona_pool(lock_expires_at);

alter table persona_pool enable row level security;

drop policy if exists "service role persona_pool" on persona_pool;
create policy "service role persona_pool" on persona_pool for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
