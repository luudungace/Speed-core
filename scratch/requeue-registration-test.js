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
  // Target: https://forums.realgm.com/boards/viewforum.php?f=6
  const jobId = 'aff76ac8-8783-4b81-ae99-28d9d978c11c';
  
  console.log(`Requeuing job ${jobId} as a pure registration task...`);
  
  const { data, error } = await supabase
    .from('registration_jobs')
    .update({ 
      status: 'queued', 
      username: null,
      password: null,
      error: null,
      updated_at: new Date().toISOString() 
    })
    .eq('id', jobId)
    .select('*');
  
  if (error) {
    console.error('Error updating job:', error);
  } else {
    console.log('Successfully requeued job for pure registration test:', JSON.stringify(data, null, 2));
  }
}
run();
