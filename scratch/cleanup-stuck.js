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

async function cleanStuckJobsAndEmails() {
  console.log('--- ĐANG DỌN DẸP HÀNG ĐỢI & TÀI NGUYÊN BỊ KẸT ---');
  
  // 1. Unlock stuck jobs (stuck in 'processing' status)
  const { data: stuckJobs, error: jobErr } = await sb
    .from('registration_jobs')
    .update({ status: 'queued' })
    .eq('status', 'processing')
    .select('id, url');

  if (jobErr) {
    console.error('Lỗi giải phóng jobs:', jobErr.message);
  } else {
    console.log(`✅ Đã giải phóng thành công ${stuckJobs ? stuckJobs.length : 0} jobs bị kẹt về trạng thái queued.`);
  }

  // 2. Unlock locked emails
  const { data: stuckEmails, error: emailErr } = await sb
    .from('emails')
    .update({ status: 'available', locked_at: null })
    .eq('status', 'locked')
    .select('email');

  if (emailErr) {
    console.error('Lỗi giải phóng emails:', emailErr.message);
  } else {
    console.log(`✅ Đã giải phóng thành công ${stuckEmails ? stuckEmails.length : 0} emails bị kẹt về trạng thái available.`);
  }

  // 3. Unlock locked proxies
  const { data: stuckProxies, error: proxyErr } = await sb
    .from('proxies')
    .update({ status: 'available', locked_at: null })
    .eq('status', 'locked')
    .select('host, port');

  if (proxyErr) {
    console.error('Lỗi giải phóng proxies:', proxyErr.message);
  } else {
    console.log(`✅ Đã giải phóng thành công ${stuckProxies ? stuckProxies.length : 0} proxies bị kẹt về trạng thái available.`);
  }
}

cleanStuckJobsAndEmails();
