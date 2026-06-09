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

const cmsPersonas = [
  {
    display_name: 'phpBB Board Master',
    username_base: 'phpbb_user',
    bio: 'Professional phpBB forum administrator and open source community manager. Enthusiastic about discussion board configuration and database management.',
    gender: 'Male',
    country: 'US'
  },
  {
    display_name: 'WordPress Blogger',
    username_base: 'wp_blogger',
    bio: 'WordPress theme customizer, blogger, and plugin developer. Dedicated to building responsive layouts, publishing digital content, and optimizing web experiences.',
    gender: 'Female',
    country: 'UK'
  },
  {
    display_name: 'XenForo Administrator',
    username_base: 'xenforo_admin',
    bio: 'Experienced XenForo community builder and addon designer. I love designing engaging modern forums, styles, and custom widgets.',
    gender: 'Male',
    country: 'CA'
  },
  {
    display_name: 'Flatboard Enthusiast',
    username_base: 'flatboard_user',
    bio: 'Flatboard administrator and web hobbyist. Fan of lightweight CMS platforms, minimal flat-file forum databases, and fast website performance.',
    gender: 'Female',
    country: 'AU'
  }
];

async function insert() {
  console.log('Inserting 4 CMS-focused forum personas...');
  const { data, error } = await supabase
    .from('personas')
    .insert(cmsPersonas)
    .select();

  if (error) {
    console.error('Error inserting CMS personas:', error);
  } else {
    console.log('Successfully inserted CMS personas:');
    console.log(data);
  }
}

insert();
