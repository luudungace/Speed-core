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

async function checkFailedJobs() {
  console.log('--- DANH SÁCH CÁC JOB THẤT BẠI VÀ LÝ DO CHÌA KHÓA ---');
  const { data, error } = await sb
    .from('registration_jobs')
    .select('id, url, status, cms_type, error, updated_at')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(15);

  if (error) {
    console.error('Lỗi truy vấn:', error.message);
    return;
  }

  data.forEach((job, idx) => {
    console.log(`${idx + 1}. URL: ${job.url}`);
    console.log(`   CMS: ${job.cms_type} | Thời gian: ${job.updated_at}`);
    console.log(`   Lỗi: \x1b[31m${job.error}\x1b[0m`);
    console.log('----------------------------------------------------');
  });
}

checkFailedJobs();
