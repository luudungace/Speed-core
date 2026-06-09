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
  // 1. Temporarily pause other queued jobs
  console.log('Pausing other queued jobs...');
  await sb.from('registration_jobs')
    .update({ status: 'failed', error: 'Paused for testing' })
    .eq('status', 'queued');

  // 2. Requeue target job
  const jobId = '11fa896e-bd1e-4919-99da-5c915c499e20';
  console.log(`Requeuing target test job ${jobId}...`);
  await sb.from('registration_jobs')
    .update({
      status: 'queued',
      username: null,
      password: null,
      error: null,
      email_used: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);

  // 3. Make sure test email is available
  console.log('Setting test email mama0874160121+test1@gmail.com to available...');
  await sb.from('emails')
    .update({ status: 'available', locked_at: null })
    .eq('email', 'mama0874160121+test1@gmail.com');

  console.log('Setup ready!');
}

run();
