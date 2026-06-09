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
  // 1. Check jobs count by status
  const { data: jobs, error: jErr } = await sb.from('registration_jobs').select('status');
  if (jErr) console.error(jErr);
  
  const jobCounts = {};
  if (jobs) {
    jobs.forEach(j => {
      jobCounts[j.status] = (jobCounts[j.status] || 0) + 1;
    });
  }

  // 2. Check email resources by status
  const { data: emails, error: eErr } = await sb.from('emails').select('status');
  if (eErr) console.error(eErr);

  const emailCounts = {};
  if (emails) {
    emails.forEach(e => {
      emailCounts[e.status] = (emailCounts[e.status] || 0) + 1;
    });
  }

  // 3. Print out results
  console.log('=== TRẠNG THÁI HÀNG ĐỢI NHIỆM VỤ (registration_jobs) ===');
  console.log(JSON.stringify(jobCounts, null, 2));
  console.log('\n=== TRẠNG THÁI TÀI NGUYÊN EMAIL (emails) ===');
  console.log(JSON.stringify(emailCounts, null, 2));

  // 4. Print any processing jobs specifically
  const { data: procJobs } = await sb.from('registration_jobs').select('id, url, status, error, updated_at').eq('status', 'processing');
  if (procJobs && procJobs.length > 0) {
    console.log('\n=== CÁC JOB ĐANG CHẠY (status: processing) ===');
    console.log(JSON.stringify(procJobs, null, 2));
  } else {
    console.log('\nKhông có job nào đang ở trạng thái "processing".');
  }

  // 5. Print a few queued jobs
  const { data: queuedJobs } = await sb.from('registration_jobs').select('id, url, status').eq('status', 'queued').limit(5);
  console.log('\n=== MỘT SỐ JOB ĐANG XẾP HÀNG (status: queued) ===');
  console.log(JSON.stringify(queuedJobs, null, 2));
}

run();
