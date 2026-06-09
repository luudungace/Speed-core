const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
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
        process.env[key] = value;
      }
    }
  }
}
loadEnv();

async function check() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("Supabase URL:", url);

  const supabase = createClient(url, key);

  const { data: jobs, error: err1 } = await supabase.from("registration_jobs").select("id, url, status, error, cms_type");
  if (err1) console.error("Error fetching jobs:", err1);
  else console.log(`\n--- JOBS (${jobs.length}) ---`, jobs);

  const { data: emails, error: err2 } = await supabase.from("emails").select("email, status");
  if (err2) console.error("Error fetching emails:", err2);
  else console.log(`\n--- EMAILS (${emails.length}) ---`, emails);

  const { data: personas, error: err3 } = await supabase.from("personas").select("id, username");
  if (err3) console.error("Error fetching personas:", err3);
  else console.log(`\n--- PERSONAS (${personas.length}) ---`, personas);

  const { data: proxies, error: err4 } = await supabase.from("proxies").select("host, status");
  if (err4) console.error("Error fetching proxies:", err4);
  else console.log(`\n--- PROXIES (${proxies.length}) ---`, proxies);
}

check();
