const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPull() {
  try {
    const { data: job, error: jobError } = await supabase
      .from("registration_jobs")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (jobError) throw jobError;
    console.log("Job selected:", job);
    if (!job) return;

    const { data: emailData, error: emailError } = await supabase
      .from("emails")
      .select("*")
      .eq("status", "available")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (emailError) throw emailError;
    console.log("Email selected:", emailData);

    const { data: proxy, error: proxyError } = await supabase
      .from("proxies")
      .select("*")
      .eq("status", "available")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (proxyError) throw proxyError;
    console.log("Proxy selected:", proxy);

    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (personaError) throw personaError;
    console.log("Persona selected:", persona);

  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

testPull();
