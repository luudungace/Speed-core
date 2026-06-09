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

async function checkSuccessJobs() {
  console.log('--- DANH SÁCH CÁC JOB THÀNH CÔNG VÀ LINK BÀI VIẾT ĐÃ ĐĂNG ---');
  const { data, error } = await sb
    .from('registration_jobs')
    .select('id, url, status, username, posted_url, updated_at')
    .eq('status', 'success')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Lỗi truy vấn:', error.message);
    return;
  }

  data.forEach((job, idx) => {
    console.log(`${idx + 1}. Diễn đàn: ${job.url}`);
    console.log(`   Tài khoản: ${job.username}`);
    console.log(`   Link bài đăng: \x1b[32m${job.posted_url}\x1b[0m`);
    console.log(`   Thời gian: ${job.updated_at}`);
    console.log('----------------------------------------------------');
  });
}

checkSuccessJobs();
