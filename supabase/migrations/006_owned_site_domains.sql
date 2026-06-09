create table if not exists owned_site_domains (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  domain text not null unique,
  label text,
  registration_notes text,
  enabled boolean not null default true
);

alter table site_profiles
  add column if not exists owner_authorized boolean not null default false;

create index if not exists idx_owned_site_domains_enabled on owned_site_domains(enabled);

alter table owned_site_domains enable row level security;

drop policy if exists "service role owned_site_domains" on owned_site_domains;
create policy "service role owned_site_domains" on owned_site_domains for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
