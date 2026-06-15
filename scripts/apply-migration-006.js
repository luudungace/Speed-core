const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnv() {
  const envPath = path.join(__dirname, "../.env");
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

function projectRefFromUrl(url) {
  const match = String(url).match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

const SQL = fs.readFileSync(path.join(__dirname, "../supabase/migrations/006_add_publish_date.sql"), "utf8");

async function tryConnect(config) {
  const client = new Client({
    ...config,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log(`\n🔌 Thử kết nối: ${config.label}...`);
    await client.connect();
    await client.query(SQL);
    console.log("✅ Đã thêm cột publish_date vào discovered_forums.");
    await client.end();
    return true;
  } catch (error) {
    console.log(`❌ ${config.label}: ${error.message.slice(0, 160)}`);
    try {
      await client.end();
    } catch {
      // ignore
    }
    return false;
  }
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef = projectRefFromUrl(supabaseUrl);
  const password = env.SUPABASE_DB_PASSWORD || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!projectRef || !password) {
    console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env");
    process.exit(1);
  }

  console.log(`🚀 Migration 006 — project: ${projectRef}`);

  const regions = ["ap-southeast-1", "ap-northeast-1", "us-east-1", "eu-west-1"];
  const configs = [];

  for (const region of regions) {
    configs.push({
      label: `Pooler ${region} :6543`,
      host: `aws-0-${region}.pooler.supabase.com`,
      port: 6543,
      user: `postgres.${projectRef}`,
      password,
    });
    configs.push({
      label: `Pooler ${region} :5432`,
      host: `aws-0-${region}.pooler.supabase.com`,
      port: 5432,
      user: `postgres.${projectRef}`,
      password,
    });
  }

  configs.push({
    label: "Direct DB :5432",
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
  });

  for (const config of configs) {
    const ok = await tryConnect(config);
    if (ok) return;
  }

  console.error("\n⚠️  Không kết nối được Postgres tự động.");
  console.error("Chạy SQL sau trong Supabase SQL Editor:");
  console.error(SQL.trim());
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
