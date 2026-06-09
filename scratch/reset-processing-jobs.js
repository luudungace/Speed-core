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
  console.log("Resetting processing jobs to failed...");
  const { data: jobs, error: err1 } = await supabase
    .from("registration_jobs")
    .update({ status: "failed", error: "Aborted/Reset" })
    .eq("status", "processing")
    .select("*");

  if (err1) {
    console.error("Error resetting jobs:", err1.message);
  } else {
    console.log(`Reset ${jobs.length} jobs.`);
  }

  console.log("Unlocking locked emails...");
  const { data: emails, error: err2 } = await supabase
    .from("emails")
    .update({ status: "available", locked_at: null })
    .eq("status", "locked")
    .select("*");

  if (err2) {
    console.error("Error unlocking emails:", err2.message);
  } else {
    console.log(`Unlocked ${emails.length} emails.`);
  }
}

run();
