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
  const targetUrl = 'https://pikniktv.info/viewtopic.php?t=10493';

  // 1. Tìm email available
  const { data: emails } = await supabase
    .from('emails')
    .select('*')
    .eq('status', 'available')
    .limit(1);

  if (!emails || emails.length === 0) {
    console.error('❌ Không có email available!');
    return;
  }

  // 2. Tìm persona available
  const { data: personas } = await supabase
    .from('personas')
    .select('*')
    .limit(1);

  if (!personas || personas.length === 0) {
    console.error('❌ Không có persona!');
    return;
  }

  const email = emails[0];
  const persona = personas[0];

  console.log(`📧 Email: ${email.email}`);
  console.log(`👤 Persona: ${persona.name || persona.id}`);

  // 3. Kiểm tra xem đã có job cho URL này chưa
  const { data: existing } = await supabase
    .from('registration_jobs')
    .select('*')
    .eq('url', targetUrl);

  if (existing && existing.length > 0) {
    // Requeue job cũ
    const { data, error } = await supabase
      .from('registration_jobs')
      .update({
        status: 'queued',
        username: null,
        password: null,
        error: null,
        email_used: email.email,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing[0].id)
      .select('*');

    if (error) console.error('❌ Lỗi requeue:', error);
    else console.log('✅ Requeued job pikniktv.info:', JSON.stringify(data, null, 2));
  } else {
    // Tạo job mới
    const { data, error } = await supabase
      .from('registration_jobs')
      .insert({
        url: targetUrl,
        cms_type: 'phpBB',
        status: 'queued',
        email_used: email.email,
        persona_used: persona.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*');

    if (error) console.error('❌ Lỗi tạo job:', error);
    else console.log('✅ Tạo job mới pikniktv.info:', JSON.stringify(data, null, 2));
  }
}
run();
