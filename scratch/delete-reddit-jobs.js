const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
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
loadEnv();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Tìm các job có url chứa reddit.com
  const { data: redditJobs, error: findError } = await sb
    .from('registration_jobs')
    .select('id, url')
    .like('url', '%reddit.com%');

  if (findError) {
    console.error('❌ Lỗi khi tìm job reddit:', findError);
    return;
  }

  if (!redditJobs || redditJobs.length === 0) {
    console.log('ℹ️ Không tìm thấy job reddit nào.');
    return;
  }

  console.log(`🔍 Tìm thấy ${redditJobs.length} job chứa reddit.com:`);
  redditJobs.forEach(j => console.log(` - ID: ${j.id} | URL: ${j.url}`));

  // Xóa các job đó
  const ids = redditJobs.map(j => j.id);
  const { error: deleteError } = await sb
    .from('registration_jobs')
    .delete()
    .in('id', ids);

  if (deleteError) {
    console.error('❌ Lỗi khi xóa job reddit:', deleteError);
  } else {
    console.log(`✅ Đã xóa thành công ${ids.length} job reddit khỏi cơ sở dữ liệu!`);
  }
}

run();
