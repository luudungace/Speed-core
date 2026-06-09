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

async function check() {
  const { data: emails, error: emailError } = await supabase.from('emails').select('*');
  const { data: proxies, error: proxyError } = await supabase.from('proxies').select('*');
  const { data: personas, error: personaError } = await supabase.from('personas').select('*');

  if (emailError) console.error('Email error:', emailError);
  else console.log('--- EMAILS IN POOL ---\n', emails);

  if (proxyError) console.error('Proxy error:', proxyError);
  else console.log('--- PROXIES IN POOL ---\n', proxies);

  if (personaError) console.error('Persona error:', personaError);
  else console.log('--- PERSONAS IN POOL ---\n', personas);
}
check();
