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

sb.from('registration_jobs')
  .select('id,url,cms_type,status,username,error,updated_at')
  .order('updated_at', { ascending: false })
  .limit(20)
  .then(({ data, error }) => {
    if (error) return console.error(error);
    console.log('\n=== DANH SÁCH JOB ĐĂNG KÝ (Mới nhất) ===\n');
    data.forEach(d => {
      console.log(`[${d.status.toUpperCase().padEnd(8)}] ${d.url.substring(0, 50).padEnd(50)} | CMS: ${(d.cms_type||'?').padEnd(8)} | User: ${(d.username||'null').padEnd(15)} | ${d.updated_at.substring(0, 16)}`);
      if (d.error) console.log(`           ⚠️  Error: ${d.error.substring(0, 80)}`);
    });
    const counts = data.reduce((acc, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc; }, {});
    console.log('\n=== THỐNG KÊ ===');
    Object.entries(counts).forEach(([s, c]) => console.log(`  ${s}: ${c}`));
  });
