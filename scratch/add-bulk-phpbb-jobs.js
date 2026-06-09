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

const urls = [
  'http://vnav.vn/forum/viewtopic.php?t=327',
  'https://forum.scssoft.com/viewtopic.php?t=266092',
  'https://forums.raspberrypi.com/viewtopic.php?t=58151',
  'https://earlywritings.com/forum/viewtopic.php?t=8203&start=20',
  'http://rockportcivicleague.org/forum/viewtopic.php?t=844',
  'https://www.voidtools.com/forum/viewtopic.php?t=14337',
  'https://forums.zimbra.org/viewtopic.php?t=74044',
  'https://forum.joomla.org/viewtopic.php?t=1008200',
  'https://forum.freecad.org/viewtopic.php?t=69055',
  'https://champman0102.net/viewtopic.php?t=6663',
  'https://forum.pdf-xchange.com/viewtopic.php?t=36579',
];

async function main() {
  const inserts = urls.map(url => ({
    url,
    cms_type: 'phpBB',
    status: 'queued',
  }));

  console.log(`Đang thêm ${inserts.length} URL phpBB vào hàng đợi đăng ký...`);

  const { data, error } = await sb
    .from('registration_jobs')
    .upsert(inserts, { onConflict: 'url' })
    .select('url, cms_type, status');

  if (error) {
    console.error('Lỗi:', error.message);
    process.exit(1);
  }

  console.log(`✅ Đã thêm thành công ${data.length} job:`);
  data.forEach(j => console.log(`  - ${j.url} [${j.cms_type}]`));
}

main();
