const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split(/\r?\n/).forEach(l => {
    const c = l.trim();
    if (!c || c.startsWith('#')) return;
    const e = c.indexOf('=');
    if (e > 0) {
      let v = c.substring(e + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[c.substring(0, e).trim()] = v;
    }
  });
}
loadEnv();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Check QCAD job
  const { data: job } = await sb.from('registration_jobs').select('id,status,error').eq('id', '68ec5425-221f-43bd-9182-e184d79f9bec').maybeSingle();
  console.log('QCAD job:', JSON.stringify(job));

  // Check: maybe the job is being picked but URL is wrong - need to check API response
  const res = await fetch('http://localhost:3000/api/public/worker/registration');
  const json = await res.json();
  console.log('API response:', JSON.stringify(json));
}
run();
