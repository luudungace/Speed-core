const { Client } = require("pg");

const DB_PASSWORD = "mama0874160121@gmail.com";
const PROJECT_REF = "xfpizmsmtycrwuvhwgkc";

const config = {
  host: "aws-0-ap-southeast-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: `postgres.${PROJECT_REF}`,
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
};

const SQL_JOBS = `
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
create index if not exists idx_registration_jobs_status on registration_jobs(status);
alter table registration_jobs enable row level security;
drop policy if exists "service role registration_jobs" on registration_jobs;
create policy "service role registration_jobs" on registration_jobs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
`;

async function run() {
  const client = new Client(config);
  try {
    console.log("Connecting to database...");
    await client.connect();
    console.log("Connected successfully! Creating registration_jobs table...");
    await client.query(SQL_JOBS);
    console.log("✅ Table registration_jobs created successfully!");
  } catch (err) {
    console.error("❌ Failed to create table:", err);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
