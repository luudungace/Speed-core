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
  const { data, error } = await sb
    .from('emails')
    .update({ status: 'available' })
    .eq('email', 'mama0874160121@gmail.com')
    .select('*');

  if (error) {
    console.error('❌ Lỗi khi cập nhật trạng thái email:', error);
  } else {
    console.log('✅ Đã cập nhật trạng thái email mama0874160121@gmail.com thành available:', JSON.stringify(data, null, 2));
  }
}

run();
