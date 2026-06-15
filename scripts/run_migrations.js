const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const DB_PASSWORD = "mama0874160121@gmail.com";
const PROJECT_REF = "xfpizmsmtycrwuvhwgkc";

const configs = [
  // 1. Connection Pooler (AP Southeast 1 - Singapore) on port 6543
  {
    host: "aws-0-ap-southeast-1.pooler.supabase.com",
    port: 6543,
    database: "postgres",
    user: `postgres.${PROJECT_REF}`,
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  },
  // 2. Connection Pooler on port 5432
  {
    host: "aws-0-ap-southeast-1.pooler.supabase.com",
    port: 5432,
    database: "postgres",
    user: `postgres.${PROJECT_REF}`,
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  },
  // 3. Direct host (requires IPv6 support) on port 5432
  {
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  }
];

async function run() {
  let client;
  let connected = false;

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    console.log(`\n[Attempt ${i + 1}/${configs.length}] Connecting to ${config.host}:${config.port}...`);
    client = new Client(config);
    try {
      await client.connect();
      console.log(`✅ Connected successfully to ${config.host}:${config.port}!`);
      connected = true;
      break;
    } catch (err) {
      console.error(`❌ Connection failed: ${err.message}`);
      try {
        await client.end();
      } catch (e) {}
    }
  }

  if (!connected) {
    console.error("\n❌ Could not connect to the database using any connection configuration.");
    process.exit(1);
  }

  try {
    // Read migrations
    const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .sort();

    console.log(`\nFound ${files.length} migration files. Running them sequentially...`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      console.log(`\nExecuting migration: ${file}...`);
      const sql = fs.readFileSync(filePath, "utf-8");
      
      // Execute query
      await client.query(sql);
      console.log(`✅ Successfully executed ${file}`);
    }

    // Restore emails
    console.log("\nRestoring 4 backed up emails...");
    const backupPath = "C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\e5a38748-62d7-4c86-a355-251bfb84b1e1\\scratch\\backup_emails.json";
    if (fs.existsSync(backupPath)) {
      const emailsData = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
      for (const em of emailsData) {
        // Insert query
        const query = {
          text: `
            INSERT INTO emails (id, created_at, updated_at, email, password, imap_host, imap_port, status, locked_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (email) DO NOTHING
          `,
          values: [
            em.id,
            em.created_at,
            em.updated_at,
            em.email,
            em.password,
            em.imap_host,
            em.imap_port,
            em.status,
            em.locked_at
          ]
        };
        await client.query(query);
        console.log(` - Restored email: ${em.email}`);
      }
      console.log("✅ Successfully restored all emails!");
    } else {
      console.warn("⚠️ No backup_emails.json file found to restore.");
    }

    console.log("\n🎉 ALL MIGRATIONS AND RESTORE COMPLETED SUCCESSFULLY!");

  } catch (err) {
    console.error("\n❌ Error during migration execution:", err);
  } finally {
    try {
      await client.end();
      console.log("Database connection closed.");
    } catch (e) {}
  }
}

run().catch(console.error);
