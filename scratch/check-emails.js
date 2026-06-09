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

async function run() {
  const { data: emails, error } = await sb
    .from('emails')
    .select('*');

  if (error) {
    console.error('❌ Lỗi khi tải email:', error);
    return;
  }

  console.log('\n=== DANH SÁCH EMAIL TRONG HỆ THỐNG ===\n');
  emails.forEach(e => {
    console.log(`📧 Email: ${e.email} | Trạng thái: ${e.status} | IMAP: ${e.imap_host}:${e.imap_port}`);
  });
}

run();
