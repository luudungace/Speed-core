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

async function requeueFailed() {
  // Query 5 most recent failed jobs
  const { data: jobs, error: fetchError } = await supabase
    .from('registration_jobs')
    .select('id, url, error')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(5);

  if (fetchError) {
    console.error('Error fetching failed jobs:', fetchError);
    return;
  }

  if (!jobs || jobs.length === 0) {
    console.log('Không tìm thấy job thất bại nào.');
    return;
  }

  console.log(`Đang chạy lại 5 job đăng ký thất bại gần nhất:`);
  for (const job of jobs) {
    console.log(`- URL: ${job.url}\n  Lỗi cũ: ${job.error}`);
    const { error: updateError } = await supabase
      .from('registration_jobs')
      .update({
        status: 'queued',
        error: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    if (updateError) {
      console.error(`  ❌ Lỗi khi cập nhật job ${job.id}:`, updateError);
    } else {
      console.log(`  ✅ Đã chuyển trạng thái thành 'queued'`);
    }
  }
  console.log('\n=== Hoàn tất! ===');
}

requeueFailed();
