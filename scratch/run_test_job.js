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

async function run() {
  console.log("Tìm kiếm job XenForo bị lỗi (để test bộ lọc Honeypot mới)...");
  
  const { data: jobs, error } = await supabase
    .from('registration_jobs')
    .select('*')
    .eq('cms_type', 'XenForo')
    .eq('status', 'failed')
    .limit(1);
    
  if (error) {
    console.error('Lỗi khi lấy jobs:', error.message);
    return;
  }
  
  if (jobs.length === 0) {
    console.log("Không tìm thấy job XenForo nào bị lỗi. Hãy tìm job đang chờ (queued)...");
    const { data: queuedJobs, error: qErr } = await supabase
      .from('registration_jobs')
      .select('*')
      .eq('cms_type', 'XenForo')
      .eq('status', 'queued')
      .limit(1);
      
    if (qErr || queuedJobs.length === 0) {
      console.log("Không tìm thấy job XenForo nào cả.");
      return;
    }
    
    const job = queuedJobs[0];
    console.log(`Chạy test cho Job ID: ${job.id} | URL: ${job.url}`);
    
    // Set status to 'queued' just in case, reset error
    await supabase.from('registration_jobs').update({ status: 'queued', error: null }).eq('id', job.id);
    console.log("Đã cập nhật trạng thái job thành queued. Đang khởi chạy worker...");
  } else {
    const job = jobs[0];
    console.log(`Re-queueing Job ID: ${job.id} | URL: ${job.url}`);
    await supabase.from('registration_jobs').update({ status: 'queued', error: null }).eq('id', job.id);
    console.log("Đã reset trạng thái job lỗi thành queued. Đang khởi chạy worker...");
  }
  
  console.log("\nChạy thử lệnh worker đăng ký:");
  console.log("powershell -ExecutionPolicy Bypass -Command \"node worker.js --mode=register\"");
}

run();
