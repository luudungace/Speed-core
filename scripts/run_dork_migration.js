const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const DB_PASSWORD = "mama0874160121@gmail.com";
const PROJECT_REF = "xfpizmsmtycrwuvhwgkc";

const REGIONS = [
  "ap-southeast-1", // Singapore
  "ap-northeast-1", // Tokyo
  "ap-northeast-2", // Seoul
  "ap-south-1",     // Mumbai
  "ap-southeast-2", // Sydney
  "us-east-1",      // N. Virginia
  "us-west-1",      // N. California
  "us-west-2",      // Oregon
  "eu-central-1",   // Frankfurt
  "eu-west-1",      // Ireland
  "eu-west-2",      // London
  "sa-east-1",      // Sao Paulo
];

const migrationFile = path.join(__dirname, "..", "supabase", "migrations", "005_dork_scraper_discovery.sql");
const sql = fs.readFileSync(migrationFile, "utf-8");

async function tryConnect(config, label) {
  const client = new Client({
    ...config,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 4000,
  });
  try {
    console.log(`🔌 Thử kết nối: ${label}...`);
    await client.connect();
    console.log(`✅ Kết nối thành công! Đang chạy SQL...`);
    await client.query(sql);
    console.log(`🎉 CHẠY MIGRATION 005 THÀNH CÔNG!`);
    await client.end();
    return true;
  } catch (err) {
    const msg = err.message;
    if (msg.includes("password authentication failed")) {
      console.log(`❌ Sai mật khẩu: ${label}`);
    } else if (msg.includes("tenant") && msg.includes("not found")) {
      // Not the right region, silent or output simple message
    } else {
      console.log(`❌ ${label} lỗi: ${msg}`);
    }
    try { await client.end(); } catch {}
    return false;
  }
}

async function run() {
  console.log("🚀 Bắt đầu khởi tạo các bảng dork_scraper trên database mới...");
  
  for (const region of REGIONS) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const ok = await tryConnect({
      host, port: 6543,
      database: "postgres",
      user: `postgres.${PROJECT_REF}`,
      password: DB_PASSWORD,
    }, `Pooler ${region} (Port 6543)`);
    if (ok) return;

    const ok2 = await tryConnect({
      host, port: 5432,
      database: "postgres",
      user: `postgres.${PROJECT_REF}`,
      password: DB_PASSWORD,
    }, `Pooler ${region} (Port 5432)`);
    if (ok2) return;
  }
  
  // Thử kết nối trực tiếp (nếu mạng hỗ trợ IPv6)
  const okDirect = await tryConnect({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: DB_PASSWORD,
  }, "Direct Host (IPv6)");
  if (okDirect) return;

  console.log("\n⚠️ Không thể kết nối tự động tới database mới của anh.");
  console.log("👉 Vui lòng truy cập: https://supabase.com/dashboard/project/xfpizmsmtycrwuvhwgkc/sql/new");
  console.log("   Và copy toàn bộ nội dung file: supabase/migrations/005_dork_scraper_discovery.sql vào để chạy.");
}

run().catch(console.error);
