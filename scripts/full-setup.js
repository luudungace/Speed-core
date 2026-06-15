// Migration + setup đầy đủ cho project klopkkqxmnmnmupfrpza
const SUPABASE_URL = "https://klopkkqxmnmnmupfrpza.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtsb3Bra3F4bW5tbm11cGZycHphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMzMzA2NSwiZXhwIjoyMDk2OTA5MDY1fQ.9ZiXFngN3sszvaej-lU95LEpquSmYNFIzBPQ5Eg-eUc";

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ===== STEP 1: MIGRATION =====
async function runMigration() {
  console.log("📦 STEP 1: Chạy SQL migration...");

  const tables = [
    {
      name: "emails",
      sql: `create table if not exists emails (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), email text not null unique, password text not null, imap_host text not null default 'imap.gmail.com', imap_port integer not null default 993, status text not null default 'available' check (status in ('available', 'locked', 'used')), locked_at timestamptz null)`
    },
    {
      name: "personas",
      sql: `create table if not exists personas (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), display_name text not null, username_base text not null, bio text null, gender text null, country text null)`
    },
    {
      name: "registration_jobs",
      sql: `create table if not exists registration_jobs (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), url text not null unique, cms_type text not null, status text not null default 'queued' check (status in ('queued', 'processing', 'success', 'failed', 'cancelled')), username text null, password text null, email_used text null, proxy_used text null, error text null)`
    },
    {
      name: "posted_backlinks",
      sql: `create table if not exists posted_backlinks (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), forum_url text not null, posted_url text not null unique, status text not null default 'success' check (status in ('success', 'failed')), posted_at timestamptz not null default now(), details jsonb not null default '{}'::jsonb, is_alive boolean default true, last_checked_at timestamptz default null)`
    }
  ];

  for (const t of tables) {
    const { error: checkErr } = await supabase.from(t.name).select("id").limit(1);
    if (!checkErr) {
      console.log(`✅ Bảng "${t.name}" đã tồn tại!`);
    } else {
      console.log(`❌ Bảng "${t.name}" CHƯA CÓ: ${checkErr.message}`);
      console.log(`   → Cần chạy SQL trên Supabase Dashboard!`);
    }
  }
}

// ===== STEP 2: TẠO ADMIN =====
async function createAdmin() {
  console.log("\n👤 STEP 2: Tạo tài khoản admin...");
  const EMAIL = "admin@speedcore.vn";
  const PASSWORD = "SpeedCore@2026!";
  
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`✅ Admin tạo thành công: ${data.email}`);
  } else if (data.message?.includes("already") || data.code === "email_exists") {
    console.log(`ℹ️  Admin đã tồn tại rồi.`);
  } else {
    console.log(`⚠️  Admin: ${JSON.stringify(data).slice(0,200)}`);
  }
}

// ===== STEP 3: NẠP EMAILS CŨ =====
async function seedEmails() {
  console.log("\n📧 STEP 3: Nạp emails cũ...");
  const emails = [
    { email: "sumsung0617568696@gmail.com", password: "Google123@" },
    { email: "onghyr44@gmail.com", password: "Google123@" },
    { email: "mama0874160121@gmail.com", password: "Google123@" },
    { email: "arun1959mol@gmail.com", password: "Google123@" },
  ];

  for (const e of emails) {
    const { error } = await supabase.from("emails").upsert({
      email: e.email,
      password: e.password,
      status: "available"
    }, { onConflict: "email" });
    
    if (error) {
      console.log(`❌ ${e.email}: ${error.message}`);
    } else {
      console.log(`✅ ${e.email} → OK`);
    }
  }
}

async function main() {
  await runMigration();
  await createAdmin();
  await seedEmails();
  console.log("\n🎉 Hoàn thành setup!");
}

main().catch(console.error);
