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
  const email = 'mama0874160121@gmail.com';
  // App Password mới tạo từ Google (usth gneg wcpc hsoa)
  const appPassword = 'usthgnegwcpchsoa';

  console.log(`Cập nhật App Password cho email: ${email}...`);

  const { data, error } = await supabase
    .from('emails')
    .update({
      password: appPassword,
      status: 'available',
      locked_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('email', email)
    .select('*');

  if (error) {
    console.error('❌ Lỗi cập nhật:', error);
  } else {
    console.log('✅ Cập nhật App Password thành công!');
    console.log(JSON.stringify(data, null, 2));
  }
}
run();
