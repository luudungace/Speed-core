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
  const jobId = 'd9e530ae-6688-448b-b9a6-5b5c83fcb06f';

  const { data, error } = await supabase
    .from('registration_jobs')
    .update({
      cms_type: 'phpBB',   // Fix: pikniktv.info là phpBB, không phải XenForo
      status: 'queued',
      username: null,
      password: null,
      error: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)
    .select('*');

  if (error) console.error('❌ Lỗi:', error);
  else console.log('✅ Fixed CMS type -> phpBB và requeued:', JSON.stringify(data, null, 2));
}
run();
