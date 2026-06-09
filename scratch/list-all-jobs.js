const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine || cleanLine.startsWith("#")) continue;
      const firstEqual = cleanLine.indexOf("=");
      if (firstEqual > 0) {
        const key = cleanLine.substring(0, firstEqual).trim();
        let value = cleanLine.substring(firstEqual + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
      }
    }
  }
}
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: jobs, error } = await supabase
    .from("registration_jobs")
    .select("*");

  if (error) {
    console.error("Error fetching jobs:", error.message);
    return;
  }

  console.log(`Total jobs: ${jobs.length}`);
  const domainStats = {};
  for (const job of jobs) {
    try {
      const urlObj = new URL(job.url);
      const domain = urlObj.hostname.replace("www.", "");
      if (!domainStats[domain]) {
        domainStats[domain] = { total: 0, success: 0, failed: 0, processing: 0, queued: 0 };
      }
      domainStats[domain].total++;
      domainStats[domain][job.status]++;
    } catch (e) {
      // Ignore
    }
  }

  console.table(domainStats);
}

run();
