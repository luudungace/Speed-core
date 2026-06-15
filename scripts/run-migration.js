const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvcWZqa21ka2hlYmRnc3Nwd25yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTY5MTE0OSwiZXhwIjoyMDk1MjY3MTQ5fQ.ouFdasLKvG5GnACI5YrWy07MzaQUPATm6MOm_A5Ygkc";
const SUPABASE_URL = "https://foqfjkmdkhebdgsspwnr.supabase.co";

const SQL = `
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

-- Indexes
create index if not exists idx_emails_status on emails(status);
create index if not exists idx_proxies_status on proxies(status);
create index if not exists idx_registration_queue_status on registration_queue(status);
create index if not exists idx_registered_accounts_domain on registered_accounts(domain);
create index if not exists idx_posted_backlinks_posted_at on posted_backlinks(posted_at desc);

-- Enable RLS
alter table emails enable row level security;
alter table proxies enable row level security;
alter table personas enable row level security;
alter table registration_queue enable row level security;
alter table registered_accounts enable row level security;
alter table posted_backlinks enable row level security;

-- Service role policies
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
`;

async function runMigration() {
  console.log("🔄 Đang chạy migration lên Supabase...\n");

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql: SQL }),
  });

  if (!res.ok) {
    // Thử dùng pg endpoint trực tiếp
    console.log("⚠️  exec_sql không khả dụng, thử pg endpoint...");
    const pgRes = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: SQL }),
    });

    if (!pgRes.ok) {
      const errText = await pgRes.text();
      console.error("❌ Không thể chạy SQL tự động qua API.");
      console.log("\n📋 Vui lòng copy SQL và chạy thủ công trên Supabase Dashboard:");
      console.log("   👉 https://supabase.com/dashboard/project/foqfjkmdkhebdgsspwnr/sql/new");
      console.log("\nSQL cần chạy đã được lưu tại:");
      console.log("   f:\\NA NÁ NÀ NA ĐÔ MIXI\\supabase\\migrations\\003_resources_registration_backlinks.sql");
      return;
    }
    const pgData = await pgRes.json();
    console.log("✅ Migration thành công!", pgData);
    return;
  }

  const data = await res.json();
  console.log("✅ Migration thành công!", data);
}

runMigration().catch(console.error);
