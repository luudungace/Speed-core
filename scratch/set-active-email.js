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
  console.log("Configuring email statuses...");
  
  // Set mama0874160121@gmail.com to available
  const { error: err1 } = await supabase
    .from("emails")
    .update({ status: "available", locked_at: null, updated_at: new Date().toISOString() })
    .eq("email", "mama0874160121@gmail.com");
    
  if (err1) console.error("Error setting available:", err1.message);

  // Set all others to used
  const { error: err2 } = await supabase
    .from("emails")
    .update({ status: "used", locked_at: null, updated_at: new Date().toISOString() })
    .not("email", "eq", "mama0874160121@gmail.com");

  if (err2) console.error("Error setting used:", err2.message);
  
  console.log("Email statuses configured successfully.");
}

run();
