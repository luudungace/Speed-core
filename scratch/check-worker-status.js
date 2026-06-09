const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine || cleanLine.startsWith("#")) continue;
      const firstEqual = cleanLine.indexOf("=");
      if (firstEqual > 0) {
        const key = cleanLine.substring(0, firstEqual).trim();
        let value = cleanLine.substring(firstEqual + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
      }
    }
  }
}
loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStatus() {
  // Count by status
  const { data: allJobs, error } = await supabase
    .from('registration_jobs')
    .select('status, username, created_at, updated_at, url, cms_type, error')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Lỗi:', error.message);
    return;
  }

  const total = allJobs.length;
  const queued = allJobs.filter(j => j.status === 'queued').length;
  const processing = allJobs.filter(j => j.status === 'processing').length;
  const success = allJobs.filter(j => j.status === 'success').length;
  const failed = allJobs.filter(j => j.status === 'failed').length;

  console.log('=== TRẠNG THÁI HÀNG ĐỢI ĐĂNG KÝ ===');
  console.log(`Tổng jobs : ${total}`);
  console.log(`Đang chờ  : ${queued}`);
  console.log(`Đang chạy : ${processing}`);
  console.log(`Thành công: ${success}`);
  console.log(`Thất bại  : ${failed}`);
  console.log('');

  // Show processing jobs
  const processingJobs = allJobs.filter(j => j.status === 'processing');
  if (processingJobs.length > 0) {
    console.log('--- Job đang chạy (processing) ---');
    processingJobs.forEach(j => {
      console.log(`  ${j.url} [${j.cms_type}]  updated: ${j.updated_at}`);
    });
    console.log('');
  }

  // Show recent success
  const recentSuccess = allJobs.filter(j => j.status === 'success').slice(0, 5);
  if (recentSuccess.length > 0) {
    console.log('--- Mới đăng ký thành công gần đây ---');
    recentSuccess.forEach(j => {
      console.log(`  ✅ ${j.url}  username: ${j.username || '?'}  updated: ${j.updated_at}`);
    });
    console.log('');
  }

  // Show recent failures
  const recentFailed = allJobs.filter(j => j.status === 'failed').slice(0, 5);
  if (recentFailed.length > 0) {
    console.log('--- Lỗi gần đây ---');
    recentFailed.forEach(j => {
      console.log(`  ❌ ${j.url}  lỗi: ${j.error || '?'}  updated: ${j.updated_at}`);
    });
  }
}

checkStatus();
