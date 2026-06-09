create table if not exists user_pool (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  username text not null unique,
  display_name text,
  status resource_pool_status not null default 'available',
  locked_by text,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  last_used_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_user_pool_status on user_pool(status);
create index if not exists idx_user_pool_updated_at on user_pool(updated_at desc);
create index if not exists idx_user_pool_lock_expires_at on user_pool(lock_expires_at);

alter table user_pool enable row level security;

drop policy if exists "service role user_pool" on user_pool;
create policy "service role user_pool" on user_pool for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
