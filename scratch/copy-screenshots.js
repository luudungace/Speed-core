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

async function copyScreenshots() {
  const timeLimit = new Date(Date.now() - 25 * 60 * 1000).toISOString();
  
  const { data: jobs, error } = await supabase
    .from('registration_jobs')
    .select('id, url, status')
    .eq('status', 'failed')
    .gt('updated_at', timeLimit);

  if (error) {
    console.error('Error fetching jobs:', error);
    return;
  }

  const brainDir = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\66324bc3-798e-4919-b1a1-5eb4fd83c2b7';
  if (!fs.existsSync(brainDir)) {
    fs.mkdirSync(brainDir, { recursive: true });
  }

  jobs.forEach(job => {
    const src = path.join(__dirname, '..', 'screenshots', `failure_${job.id}.png`);
    if (fs.existsSync(src)) {
      const dest = path.join(brainDir, `recent_failure_${job.id}.png`);
      fs.copyFileSync(src, dest);
      console.log(`Copied screenshot for ${job.url} -> recent_failure_${job.id}.png`);
    } else {
      console.log(`No screenshot found for job ${job.id} (${job.url})`);
    }
  });
}

copyScreenshots();
