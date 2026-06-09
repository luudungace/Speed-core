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
  const targetDomain = process.argv[2];
  if (!targetDomain) {
    console.error("Usage: node requeue-any-job.js <domain>");
    process.exit(1);
  }

  console.log(`Searching for jobs on ${targetDomain}...`);
  const { data: jobs, error } = await supabase
    .from("registration_jobs")
    .select("*")
    .like("url", `%${targetDomain}%`);

  if (error) {
    console.error("Error fetching jobs:", error.message);
    return;
  }

  if (jobs.length === 0) {
    console.log("No jobs found on this domain.");
    return;
  }

  console.log(`Found ${jobs.length} jobs. Requeuing the first one...`);
  const jobToRequeue = jobs[0];

  const { data: updated, error: updateError } = await supabase
    .from("registration_jobs")
    .update({
      status: "queued",
      username: null,
      password: null,
      email_used: null,
      error: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobToRequeue.id)
    .select("*");

  if (updateError) {
    console.error("Error updating job:", updateError.message);
  } else {
    console.log("Successfully requeued job:", JSON.stringify(updated, null, 2));
  }
}

run();
