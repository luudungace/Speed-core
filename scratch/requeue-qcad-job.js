const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split(/\r?\n/).forEach(l => {
      const c = l.trim();
      if (!c || c.startsWith('#')) return;
      const eq = c.indexOf('=');
      if (eq > 0) {
        let v = c.substring(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[c.substring(0, eq).trim()] = v;
      }
    });
  }
}
loadEnv();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // 1. Unlock email
  const emailRes = await sb.from('emails').update({ status: 'available', locked_at: null }).eq('email', 'mama0874160121@gmail.com').select('id,email,status');
  console.log('Email unlock:', JSON.stringify(emailRes.data || emailRes.error));

  // 2. Fix URL & CMS type, then requeue
  const reqRes = await sb.from('registration_jobs').update({
    status: 'queued',
    url: 'https://forum.qcad.org/',
    cms_type: 'Generic',
    username: null,
    password: null,
    error: null,
    updated_at: new Date().toISOString()
  }).eq('id', '68ec5425-221f-43bd-9182-e184d79f9bec').select('id,url,cms_type,status');
  console.log('Requeued:', JSON.stringify(reqRes.data || reqRes.error, null, 2));
}
run();
