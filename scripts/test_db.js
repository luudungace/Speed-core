const { Client } = require("pg");

const REGIONS = [
  "ap-south-1",
  "ap-southeast-1",
  "ap-northeast-1",
  "us-east-1",
  "eu-west-1",
];
const PROJECT_REF = "klopkkqxmnmnmupfrpza";
const PASSWORD = "Google123@";

async function tryConnect(region) {
  const host = "2406:da1a:314:7102:4ae4:993a:4c56:83cc";
  const client = new Client({
    host,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log(`Trying region ${region}...`);
    await client.connect();
    console.log(`SUCCESS connected to ${region}!`);
    const res = await client.query("SELECT 1 as val;");
    console.log("Query test:", res.rows);
    await client.end();
    return true;
  } catch (err) {
    console.log(`Failed for ${region}: ${err.message}`);
    try { await client.end(); } catch {}
    return false;
  }
}

async function run() {
  for (const region of REGIONS) {
    const ok = await tryConnect(region);
    if (ok) return;
  }
  console.log("All pooler connections failed.");
}

run().catch(console.error);
