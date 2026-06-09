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

async function run() {
  console.log("Requeuing all 'failed' or 'running' jobs to 'queued'...");
  
  const { data, error } = await supabase
    .from('registration_jobs')
    .update({ 
      status: 'queued', 
      error: null,
      updated_at: new Date().toISOString() 
    })
    .in('status', ['failed', 'running'])
    .select('id, url');
  
  if (error) {
    console.error('Error updating jobs:', error);
  } else {
    console.log(`Successfully requeued ${data ? data.length : 0} jobs:`, JSON.stringify(data, null, 2));
  }
}
run();
