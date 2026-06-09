do $$ begin
  create type resource_pool_status as enum ('available', 'locked', 'invalid', 'disabled');
exception
  when duplicate_object then null;
end $$;

create table if not exists email_pool (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null unique,
  password_value text not null,
  imap_host text not null,
  imap_port integer not null default 993,
  status resource_pool_status not null default 'available',
  locked_by text,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  last_used_at timestamptz,
  failure_count integer not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  constraint email_pool_imap_port_valid check (imap_port between 1 and 65535)
);

create index if not exists idx_email_pool_status on email_pool(status);
create index if not exists idx_email_pool_updated_at on email_pool(updated_at desc);
create index if not exists idx_email_pool_lock_expires_at on email_pool(lock_expires_at);

alter table email_pool enable row level security;

drop policy if exists "service role email_pool" on email_pool;
create policy "service role email_pool" on email_pool for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
