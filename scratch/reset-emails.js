const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
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
}
loadEnv();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function unlockEmails() {
  console.log('Đang mở khóa các email bị kẹt (status = locked)...');
  const { data, error } = await sb
    .from('emails')
    .update({ status: 'available', locked_at: null })
    .eq('status', 'locked')
    .select('email, status');

  if (error) {
    console.error('Lỗi khi mở khóa email:', error.message);
  } else {
    console.log(`✅ Đã mở khóa thành công ${data ? data.length : 0} email:`);
    if (data) {
      data.forEach(e => console.log(`  - ${e.email} -> ${e.status}`));
    }
  }
}

unlockEmails();
