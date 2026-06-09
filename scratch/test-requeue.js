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
  // Find a failed phpBB job
  const { data: jobs, error } = await supabase
    .from('registration_jobs')
    .select('*')
    .eq('status', 'failed')
    .ilike('url', '%gentoo.org%')
    .limit(1);

  if (error) {
    console.error('Error fetching job:', error.message);
    return;
  }

  let job = jobs[0];
  if (!job) {
    // Try finding another failed phpBB job
    const { data: otherJobs, error: otherErr } = await supabase
      .from('registration_jobs')
      .select('*')
      .eq('status', 'failed')
      .eq('cms_type', 'phpBB')
      .limit(1);

    if (otherErr) {
      console.error('Error fetching other jobs:', otherErr.message);
      return;
    }
    job = otherJobs[0];
  }

  if (!job) {
    console.log('No failed phpBB job found.');
    return;
  }

  console.log(`Re-queueing Job ID: ${job.id} | URL: ${job.url}`);
  const { data, error: updateErr } = await supabase
    .from('registration_jobs')
    .update({
      status: 'queued',
      username: null,
      password: null,
      error: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', job.id)
    .select('*');

  if (updateErr) {
    console.error('Error updating job:', updateErr.message);
  } else {
    console.log('Successfully updated:', JSON.stringify(data, null, 2));
  }
}

run();
