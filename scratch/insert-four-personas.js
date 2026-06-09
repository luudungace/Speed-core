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

const newPersonas = [
  {
    display_name: 'TechWizard',
    username_base: 'DevGeek',
    bio: 'Passionate web developer and software engineer. I love exploring new open source frameworks, modern web tech, and sharing programming tips.',
    gender: 'Male',
    country: 'US'
  },
  {
    display_name: 'CryptoNerd',
    username_base: 'BitBull',
    bio: 'Web3 enthusiast and crypto research analyst. Deeply interested in blockchain infrastructure, smart contracts, decentralized finance, and tech innovations.',
    gender: 'Female',
    country: 'UK'
  },
  {
    display_name: 'PixelPlayer',
    username_base: 'PixelKnight',
    bio: 'Indie game developer, retro game enthusiast, and tech reviewer. Love analyzing game mechanics, digital art, and interactive storytelling.',
    gender: 'Male',
    country: 'CA'
  },
  {
    display_name: 'LifeExplorer',
    username_base: 'DailyLurker',
    bio: 'Avid reader, traveler, and amateur photographer. I enjoy participating in general discussions about life, hobbies, fitness, and modern culture.',
    gender: 'Female',
    country: 'AU'
  }
];

async function insert() {
  console.log('Inserting 4 new forum personas into the database...');
  const { data, error } = await supabase
    .from('personas')
    .insert(newPersonas)
    .select();

  if (error) {
    console.error('Error inserting personas:', error);
  } else {
    console.log('Successfully inserted personas:');
    console.log(data);
  }
}

insert();
