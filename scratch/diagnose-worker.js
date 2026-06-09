const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const content = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
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

async function diagnose() {
  // Check available emails
  const { data: emails, error: emailErr } = await sb.from('emails').select('email, status').order('status');
  console.log('\n=== EMAILS ===');
  if (emailErr) console.error('Lỗi:', emailErr.message);
  else {
    const available = emails.filter(e => e.status === 'available');
    const locked = emails.filter(e => e.status === 'locked');
    const used = emails.filter(e => e.status === 'used');
    console.log(`Available: ${available.length}, Locked: ${locked.length}, Used: ${used.length}`);
    if (available.length > 0) console.log('  Available:', available.map(e => e.email).join(', '));
  }

  // Check personas
  const { data: personas, error: personaErr } = await sb.from('personas').select('id, username_base').limit(5);
  console.log('\n=== PERSONAS ===');
  if (personaErr) console.error('Lỗi:', personaErr.message);
  else console.log(`Count: ${personas.length}`, personas.map(p => p.username_base));

  // Check queued jobs
  const { data: queuedJobs, error: jobErr } = await sb.from('registration_jobs').select('id, url, cms_type').eq('status', 'queued').limit(5);
  console.log('\n=== QUEUED JOBS ===');
  if (jobErr) console.error('Lỗi:', jobErr.message);
  else {
    console.log(`Count: ${queuedJobs.length}`);
    queuedJobs.forEach(j => console.log(`  - ${j.url} [${j.cms_type}]`));
  }

  // Simulate pulling next job to get actual error
  console.log('\n=== THỬ GỌI API pullNextJobForWorker ===');
  try {
    const res = await fetch(process.env.SERVER_URL + '/api/public/worker/registration?isDirect=false');
    const data = await res.json();
    if (res.ok) {
      console.log('API OK:', data.task ? `Job: ${data.task.url}` : 'No task (queue empty)');
    } else {
      console.log('API Error HTTP', res.status, ':', data.error);
    }
  } catch (e) {
    console.log('Fetch failed:', e.message);
  }
}

diagnose();
