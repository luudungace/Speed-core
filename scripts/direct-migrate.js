const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// Supabase project connection via Transaction Pooler
// User format: postgres.[project-ref]
// Password: service_role key hoặc database password
const PROJECT_REF = "foqfjkmdkhebdgsspwnr";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvcWZqa21ka2hlYmRnc3Nwd25yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTY5MTE0OSwiZXhwIjoyMDk1MjY3MTQ5fQ.ouFdasLKvG5GnACI5YrWy07MzaQUPATm6MOm_A5Ygkc";

const SQL = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/003_resources_registration_backlinks.sql"),
  "utf8"
);

const CONFIGS = [
  // Transaction pooler (port 6543)
  {
    label: "Transaction Pooler (6543)",
    host: `aws-0-ap-northeast-1.pooler.supabase.com`,
    port: 6543,
    database: "postgres",
    user: `postgres.${PROJECT_REF}`,
    password: SERVICE_KEY,
    ssl: { rejectUnauthorized: false },
  },
  // Session pooler (port 5432)
  {
    label: "Session Pooler (5432)",
    host: `aws-0-ap-northeast-1.pooler.supabase.com`,
    port: 5432,
    database: "postgres",
    user: `postgres.${PROJECT_REF}`,
    password: SERVICE_KEY,
    ssl: { rejectUnauthorized: false },
  },
  // Direct connection
  {
    label: "Direct DB (5432)",
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: SERVICE_KEY,
    ssl: { rejectUnauthorized: false },
  },
];

async function tryConnect(config) {
  const client = new Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
    connectionTimeoutMillis: 8000,
  });

  try {
    console.log(`\n🔌 Thử kết nối: ${config.label}...`);
    await client.connect();
    console.log(`✅ Kết nối thành công! Đang chạy migration...`);
    await client.query(SQL);
    console.log(`\n🎉 MIGRATION THÀNH CÔNG! Tất cả bảng đã được tạo.`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`❌ Thất bại: ${err.message.slice(0, 120)}`);
    try { await client.end(); } catch {}
    return false;
  }
}

async function run() {
  console.log("🚀 Bắt đầu chạy migration...\n");
  for (const config of CONFIGS) {
    const ok = await tryConnect(config);
    if (ok) return;
  }
  console.log("\n⚠️  Không thể kết nối tự động.");
  console.log("👉 Anh cần cung cấp Database Password từ:");
  console.log("   https://supabase.com/dashboard/project/foqfjkmdkhebdgsspwnr/settings/database");
}

run().catch(console.error);
