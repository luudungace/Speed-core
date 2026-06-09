do $$ begin
  create type registration_account_status as enum ('manual_saved', 'active', 'needs_verification', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists registration_accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  domain text not null,
  register_url text,
  login_url text not null,
  account_email text not null,
  username text,
  password_value text not null,
  status registration_account_status not null default 'manual_saved',
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_registration_accounts_domain on registration_accounts(domain);
create index if not exists idx_registration_accounts_status on registration_accounts(status);
create index if not exists idx_registration_accounts_created_at on registration_accounts(created_at desc);

alter table registration_accounts enable row level security;

drop policy if exists "service role registration_accounts" on registration_accounts;
create policy "service role registration_accounts" on registration_accounts for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
