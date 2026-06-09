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

async function analyzeErrors() {
  console.log('--- PHÂN TÍCH LÝ DO THẤT BẠI CỦA CÁC JOB ---');
  const { data, error } = await sb
    .from('registration_jobs')
    .select('status, error, url');

  if (error) {
    console.error('Lỗi:', error.message);
    return;
  }

  const failedJobs = data.filter(j => j.status === 'failed');
  const stats = {};
  
  failedJobs.forEach(job => {
    const err = job.error || 'Unknown error';
    let category = 'Khác';
    if (err.includes('Cloudflare') || err.includes('CAPTCHA')) {
      category = 'Bị chặn bởi Cloudflare / CAPTCHA (Cần API Key giải)';
    } else if (err.includes('điền form') || err.includes('nộp đơn đăng ký')) {
      category = 'Không tìm thấy form đăng ký (Diễn đàn khác CMS, ví dụ IPB, Discourse hoặc Custom)';
    } else if (err.includes('answer') || err.includes('sorted') || err.includes('nhãn') || err.includes('câu hỏi')) {
      category = 'Sai câu hỏi bảo mật / Anti-spam Q&A của forum';
    } else if (err.includes('username') || err.includes('forbidden')) {
      category = 'Username chứa ký tự cấm / trùng lặp';
    } else if (err.includes('đăng nhập') || err.includes('login') || err.includes('expired')) {
      category = 'Lỗi đăng nhập / Phiên hết hạn / Tài khoản chưa kích hoạt';
    } else if (err.includes('đăng bài') || err.includes('New Topic')) {
      category = 'Lỗi khi đăng bài (Không thấy nút đăng bài, bị chặn spam bài đăng)';
    }
    
    stats[category] = (stats[category] || 0) + 1;
  });

  console.log(`Tổng số Job thất bại: ${failedJobs.length}`);
  Object.keys(stats).forEach(cat => {
    console.log(`- ${cat}: ${stats[cat]} jobs (${Math.round(stats[cat]/failedJobs.length*100)}%)`);
  });
}

analyzeErrors();
