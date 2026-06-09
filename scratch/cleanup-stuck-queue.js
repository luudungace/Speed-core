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
  console.log('--- 1. Reset các job đăng ký bị treo (status = processing) ---');
  
  // Lấy các job bị treo
  const { data: stuckJobs } = await sb
    .from('registration_jobs')
    .select('id, email_used')
    .eq('status', 'processing');

  if (stuckJobs && stuckJobs.length > 0) {
    const ids = stuckJobs.map(j => j.id);
    const emailsToUnlock = stuckJobs.map(j => j.email_used).filter(Boolean);

    // Reset jobs về queued
    const { error: errJobs } = await sb
      .from('registration_jobs')
      .update({ status: 'queued', error: 'Bị treo - tự động reset bởi hệ thống', updated_at: new Date().toISOString() })
      .in('id', ids);

    if (errJobs) console.error('Lỗi reset jobs:', errJobs);
    else console.log(`Đã reset ${ids.length} jobs bị treo về queued.`);

    // Mở khóa các email đi kèm
    if (emailsToUnlock.length > 0) {
      const { error: errEmails } = await sb
        .from('emails')
        .update({ status: 'available', locked_at: null, updated_at: new Date().toISOString() })
        .in('email', emailsToUnlock);

      if (errEmails) console.error('Lỗi mở khóa emails:', errEmails);
      else console.log(`Đã mở khóa các email:`, emailsToUnlock);
    }
  } else {
    console.log('Không phát hiện job nào bị treo.');
  }

  // Mở khóa toàn bộ proxy bị khóa quá lâu
  console.log('\n--- 2. Mở khóa tài nguyên Proxy bị treo ---');
  const { error: errProxies } = await sb
    .from('proxies')
    .update({ status: 'available', locked_at: null, updated_at: new Date().toISOString() })
    .eq('status', 'locked');
  if (errProxies) console.error('Lỗi mở khóa proxies:', errProxies);
  else console.log('Đã giải phóng toàn bộ proxy bị khóa.');

  // Mở khóa toàn bộ email bị locked
  console.log('\n--- 3. Mở khóa tài nguyên Email bị locked ---');
  const { error: errAllEmails } = await sb
    .from('emails')
    .update({ status: 'available', locked_at: null, updated_at: new Date().toISOString() })
    .eq('status', 'locked');
  if (errAllEmails) console.error('Lỗi giải phóng emails:', errAllEmails);
  else console.log('Đã giải phóng toàn bộ email bị khóa.');
}

run();
