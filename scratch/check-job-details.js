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

async function checkDetails() {
  const urls = [
    'https://www.f1technical.net/forum/viewtopic.php?t=32507',
    'https://forum.egosoft.com/viewtopic.php?t=474291',
    'https://forum.theotown.com/viewtopic.php?t=29023',
    'https://forum.winehq.org/viewtopic.php?t=42441',
    'https://forums.sharpcap.co.uk/viewtopic.php?t=9324'
  ];

  const { data, error } = await supabase
    .from('registration_jobs')
    .select('id, url, status, username, password, email_used, error')
    .in('url', urls);

  if (error) {
    console.error('Error:', error);
    return;
  }

  data.forEach(job => {
    console.log(`URL: ${job.url}`);
    console.log(`Status: ${job.status}`);
    console.log(`Username: ${job.username || '(null)'}`);
    console.log(`Password: ${job.password || '(null)'}`);
    console.log(`Email Used: ${job.email_used || '(null)'}`);
    console.log(`Error: ${job.error || '(null)'}`);
    console.log('-'.repeat(40));
  });
}

checkDetails();
