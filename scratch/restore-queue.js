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
  console.log('Restoring paused queued jobs...');
  const { data: updatedJobs, error: jobErr } = await sb.from('registration_jobs')
    .update({ status: 'queued', error: null })
    .eq('error', 'Paused for testing')
    .select('id, url');

  if (jobErr) {
    console.error('Error restoring jobs:', jobErr);
  } else {
    console.log(`Successfully restored ${updatedJobs.length} jobs to queued:`, updatedJobs);
  }

  console.log('Restoring original email status...');
  const { data: updatedEmail, error: emailErr } = await sb.from('emails')
    .update({ status: 'available', locked_at: null })
    .eq('email', 'mama0874160121@gmail.com')
    .select('email, status');

  if (emailErr) {
    console.error('Error restoring email:', emailErr);
  } else {
    console.log('Successfully restored email:', updatedEmail);
  }
}

run();
