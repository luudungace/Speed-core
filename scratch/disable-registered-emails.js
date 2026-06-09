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

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const emailsToDisable = [
    "onghyr44@gmail.com",
    "mama0874160121@gmail.com",
    "mama0874160121+test1@gmail.com"
  ];

  console.log("Marking emails as used:", emailsToDisable);
  const { data, error } = await supabase
    .from("emails")
    .update({ status: "used", updated_at: new Date().toISOString() })
    .in("email", emailsToDisable);

  if (error) {
    console.error("Error updating emails:", error.message);
  } else {
    console.log("Successfully updated emails.");
  }
}

run();
