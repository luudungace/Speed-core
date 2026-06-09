const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split(/\r?\n/).forEach(line => {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) return;
    const eq = clean.indexOf('=');
    if (eq > 0) {
      let v = clean.substring(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[clean.substring(0, eq).trim()] = v;
    }
  });
}
loadEnv();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

sb.from('registration_jobs')
  .select('*')
  .eq('status', 'queued')
  .order('created_at', { ascending: true })
  .then(({ data, error }) => {
    if (error) return console.error(error);
    console.log(`Queued jobs count: ${data.length}`);
    data.forEach(job => {
      console.log(`ID: ${job.id} | URL: ${job.url} | Created At: ${job.created_at}`);
    });
  });
