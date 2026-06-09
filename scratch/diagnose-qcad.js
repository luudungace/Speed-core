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
  // Check all attempts for qcad with username
  const { data } = await sb.from('registration_jobs')
    .select('id,url,status,username,password,email_used,error,updated_at')
    .like('url', '%qcad%')
    .order('updated_at', { ascending: false })
    .limit(10);
  console.log('All QCAD attempts:');
  data.forEach(j => console.log(`  ${j.status} | user:${j.username} | email:${j.email_used} | ${j.error ? j.error.substring(0,80) : 'ok'}`));

  // Also get available emails
  const { data: emails } = await sb.from('emails').select('email,status').limit(10);
  console.log('\nEmails:');
  emails.forEach(e => console.log(`  ${e.status} | ${e.email}`));
}
run();
