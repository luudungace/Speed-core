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
  // Set QCAD job to direct login mode with known credentials from last registration
  // Username & password from the LAST successful registration attempt
  const username = 'AdamJony_145';
  const password = 'Secure@2831Abc!';

  // Unlock email
  await sb.from('emails').update({ status: 'available', locked_at: null }).eq('email', 'mama0874160121@gmail.com');

  const { data, error } = await sb.from('registration_jobs').update({
    status: 'queued',
    url: 'https://forum.qcad.org/',
    cms_type: 'Generic',
    username: username,   // Cung cấp username đã đăng ký → sẽ chuyển sang Direct Login mode
    password: password,
    error: null,
    updated_at: new Date().toISOString()
  }).eq('id', '68ec5425-221f-43bd-9182-e184d79f9bec').select('id,url,username,status');

  if (error) console.error('Error:', error);
  else console.log('Set to Direct Login mode:', JSON.stringify(data, null, 2));
}
run();
