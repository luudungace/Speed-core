const { createClient } = require('@supabase/supabase-js');
const fs = require('fs'); const path = require('path');
function loadEnv() {
  const content = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
  content.split(/\r?\n/).forEach(l => { const c = l.trim(); if (!c || c.startsWith('#')) return; const e = c.indexOf('='); if (e > 0) { let v = c.substring(e+1).trim(); if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); process.env[c.substring(0,e).trim()]=v; }});
}
loadEnv();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await sb.from('registration_jobs').select('id,url,status,cms_type,error,updated_at').like('url', '%bbox%').order('updated_at', { ascending: false }).limit(5);
  data.forEach(j => {
    console.log(`\n=== JOB: ${j.id} ===`);
    console.log(`URL: ${j.url}`);
    console.log(`CMS: ${j.cms_type} | Status: ${j.status}`);
    console.log(`Error: ${j.error || 'none'}`);
  });
}
run();
