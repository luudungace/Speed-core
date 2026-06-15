// Migration cho project MỚI klopkkqxmnmnmupfrpza
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const PROJECT_REF = "klopkkqxmnmnmupfrpza";
const SERVICE_KEY = ""; // sẽ thử nhiều cách

const SQL = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/003_resources_registration_backlinks.sql"),
  "utf8"
);

// Thêm bảng registration_jobs (bảng mới thay thế registration_queue)
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

const FULL_SQL = SQL + "\n" + SQL_JOBS;

const REGIONS = [
  "ap-south-1",    // Mumbai - project region theo settings
  "ap-southeast-1",
  "ap-northeast-1",
  "us-east-1",
  "eu-west-1",
];

async function tryConnect(config, label, sql) {
  const client = new Client({
    ...config,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  try {
    console.log(`\n🔌 Thử: ${label}...`);
    await client.connect();
    console.log(`✅ Kết nối thành công! Đang chạy SQL...`);
    await client.query(sql);
    console.log(`🎉 MIGRATION THÀNH CÔNG!`);
    await client.end();
    return true;
  } catch (err) {
    const msg = err.message;
    if (msg.includes("password authentication failed")) {
      console.log(`❌ Sai mật khẩu: ${label}`);
    } else if (msg.includes("tenant") && msg.includes("not found")) {
      // Not right region, silent
    } else {
      console.log(`❌ ${label}: ${msg.slice(0, 80)}`);
    }
    try { await client.end(); } catch {}
    return false;
  }
}

async function run() {
  console.log("🚀 Migration project MỚI klopkkqxmnmnmupfrpza...\n");
  
  for (const region of REGIONS) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const ok = await tryConnect({
      host, port: 6543,
      database: "postgres",
      user: `postgres.${PROJECT_REF}`,
      password: "Google123@",
    }, `Pooler ${region} (6543)`, FULL_SQL);
    if (ok) return;
  }
  
  // Direct connection
  const ok2 = await tryConnect({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "Google123@",
  }, "Direct DB", FULL_SQL);
  if (ok2) return;

  console.log("\n⚠️  Không kết nối được.");
  console.log("👉 Anh vào: https://supabase.com/dashboard/project/klopkkqxmnmnmupfrpza/sql/new");
  console.log("   Copy SQL từ: supabase\\migrations\\003_resources_registration_backlinks.sql");
  console.log("   + SQL cho bảng registration_jobs (em sẽ gửi anh)");
}

run().catch(console.error);
